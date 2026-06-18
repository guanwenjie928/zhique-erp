"""收款单路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel
from decimal import Decimal

from database import get_db
from models import Receipt, ReceiptItem, Receivable, Customer

router = APIRouter()


# ============================================================
# Pydantic Schemas
# ============================================================

class ReceiptItemBase(BaseModel):
    receivable_id: int
    receivable_bill_no: Optional[str] = None
    receivable_amount: Optional[Decimal] = None
    this_receipt: Decimal


class ReceiptItemCreate(ReceiptItemBase):
    pass


class ReceiptItemOut(ReceiptItemBase):
    id: int
    receipt_id: int

    class Config:
        from_attributes = True


class ReceiptBase(BaseModel):
    bill_date: date
    customer_id: int
    payment_method: Optional[str] = "bank"
    bank_account: Optional[str] = None
    remark: Optional[str] = None


class ReceiptCreate(ReceiptBase):
    items: List[ReceiptItemCreate]


class ReceiptUpdate(BaseModel):
    bill_date: Optional[date] = None
    customer_id: Optional[int] = None
    payment_method: Optional[str] = None
    bank_account: Optional[str] = None
    status: Optional[str] = None
    remark: Optional[str] = None
    items: Optional[List[ReceiptItemCreate]] = None


class ReceiptOut(ReceiptBase):
    id: int
    bill_no: str
    total_amount: Optional[Decimal] = Decimal("0")
    status: str
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    audited_by: Optional[int] = None
    audited_at: Optional[datetime] = None
    items: List[ReceiptItemOut] = []

    class Config:
        from_attributes = True


class AuditRequest(BaseModel):
    audited_by: int


# ============================================================
# Helper
# ============================================================

def _generate_bill_no(db: Session) -> str:
    today_str = date.today().strftime("%Y%m%d")
    prefix = f"REC-{today_str}-"
    count = db.query(Receipt).filter(
        Receipt.bill_no.like(f"{prefix}%")
    ).count()
    return f"{prefix}{count + 1:03d}"


# ============================================================
# Endpoints
# ============================================================

@router.get("/", response_model=List[ReceiptOut])
def list_receipts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """收款单列表"""
    query = db.query(Receipt)
    if search:
        query = query.filter(
            or_(
                Receipt.bill_no.contains(search),
                Receipt.remark.contains(search),
            )
        )
    if status:
        query = query.filter(Receipt.status == status)
    if customer_id:
        query = query.filter(Receipt.customer_id == customer_id)
    query = query.order_by(Receipt.id.desc())
    return query.offset(skip).limit(limit).all()


@router.get("/{receipt_id}", response_model=ReceiptOut)
def get_receipt(receipt_id: int, db: Session = Depends(get_db)):
    """获取收款单详情"""
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="收款单不存在")
    return receipt


@router.post("/", response_model=ReceiptOut)
def create_receipt(data: ReceiptCreate, db: Session = Depends(get_db)):
    """新增收款单"""
    if not data.items:
        raise HTTPException(status_code=400, detail="至少需要一条核销明细")
    bill_no = _generate_bill_no(db)
    total_amount = sum(item.this_receipt for item in data.items)
    receipt = Receipt(
        bill_no=bill_no,
        bill_date=data.bill_date,
        customer_id=data.customer_id,
        payment_method=data.payment_method,
        bank_account=data.bank_account,
        total_amount=total_amount,
        status="draft",
        remark=data.remark,
    )
    db.add(receipt)
    db.flush()

    for item_data in data.items:
        receivable = db.query(Receivable).filter(Receivable.id == item_data.receivable_id).first()
        item = ReceiptItem(
            receipt_id=receipt.id,
            receivable_id=item_data.receivable_id,
            receivable_bill_no=item_data.receivable_bill_no or (receivable.bill_no if receivable else None),
            receivable_amount=item_data.receivable_amount or (receivable.amount if receivable else None),
            this_receipt=item_data.this_receipt,
        )
        db.add(item)

    db.commit()
    db.refresh(receipt)
    return receipt


@router.put("/{receipt_id}", response_model=ReceiptOut)
def update_receipt(receipt_id: int, data: ReceiptUpdate, db: Session = Depends(get_db)):
    """修改收款单"""
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="收款单不存在")
    if receipt.status not in ("draft", "submitted"):
        raise HTTPException(status_code=400, detail="已审核的单据不能修改")
    update_data = data.model_dump(exclude_unset=True)
    items_data = update_data.pop("items", None)
    for key, value in update_data.items():
        setattr(receipt, key, value)
    if items_data is not None:
        db.query(ReceiptItem).filter(
            ReceiptItem.receipt_id == receipt.id
        ).delete()
        total_amount = Decimal("0")
        for item_data in items_data:
            item_obj = ReceiptItemCreate(**item_data)
            receivable = db.query(Receivable).filter(Receivable.id == item_obj.receivable_id).first()
            item = ReceiptItem(
                receipt_id=receipt.id,
                receivable_id=item_obj.receivable_id,
                receivable_bill_no=item_obj.receivable_bill_no or (receivable.bill_no if receivable else None),
                receivable_amount=item_obj.receivable_amount or (receivable.amount if receivable else None),
                this_receipt=item_obj.this_receipt,
            )
            db.add(item)
            total_amount += item_obj.this_receipt
        receipt.total_amount = total_amount
    db.commit()
    db.refresh(receipt)
    return receipt


@router.delete("/{receipt_id}")
def delete_receipt(receipt_id: int, db: Session = Depends(get_db)):
    """删除收款单"""
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="收款单不存在")
    if receipt.status not in ("draft",):
        raise HTTPException(status_code=400, detail="非草稿状态不能删除")
    db.delete(receipt)
    db.commit()
    return {"detail": "删除成功"}


@router.post("/{receipt_id}/audit", response_model=ReceiptOut)
def audit_receipt(receipt_id: int, data: AuditRequest, db: Session = Depends(get_db)):
    """审核收款单

    审核时执行:
    1. 更新应收账款的已收金额和余额
    2. 更新应收账款状态 (paid/partial)
    """
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="收款单不存在")
    if receipt.status not in ("draft", "submitted"):
        raise HTTPException(status_code=400, detail="当前状态不能审核")

    # 遍历核销明细，更新应收账款
    for item in receipt.items:
        receivable = db.query(Receivable).filter(Receivable.id == item.receivable_id).first()
        if receivable:
            receivable.received_amount = (receivable.received_amount or Decimal("0")) + item.this_receipt
            receivable.balance = (receivable.amount or Decimal("0")) - receivable.received_amount
            if receivable.balance <= 0:
                receivable.status = "paid"
            elif receivable.received_amount > 0:
                receivable.status = "partial"

    receipt.status = "audited"
    receipt.audited_by = data.audited_by
    receipt.audited_at = datetime.now()
    db.commit()
    db.refresh(receipt)
    return receipt

"""付款单路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel
from decimal import Decimal

from database import get_db
from models import Payment, PaymentItem, Payable, Supplier

router = APIRouter()


# ============================================================
# Pydantic Schemas
# ============================================================

class PaymentItemBase(BaseModel):
    payable_id: int
    payable_bill_no: Optional[str] = None
    payable_amount: Optional[Decimal] = None
    this_payment: Decimal


class PaymentItemCreate(PaymentItemBase):
    pass


class PaymentItemOut(PaymentItemBase):
    id: int
    payment_id: int

    class Config:
        from_attributes = True


class PaymentBase(BaseModel):
    bill_date: date
    supplier_id: int
    payment_method: Optional[str] = "bank"
    bank_account: Optional[str] = None
    remark: Optional[str] = None


class PaymentCreate(PaymentBase):
    items: List[PaymentItemCreate]


class PaymentUpdate(BaseModel):
    bill_date: Optional[date] = None
    supplier_id: Optional[int] = None
    payment_method: Optional[str] = None
    bank_account: Optional[str] = None
    status: Optional[str] = None
    remark: Optional[str] = None
    items: Optional[List[PaymentItemCreate]] = None


class PaymentOut(PaymentBase):
    id: int
    bill_no: str
    total_amount: Optional[Decimal] = Decimal("0")
    status: str
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    audited_by: Optional[int] = None
    audited_at: Optional[datetime] = None
    items: List[PaymentItemOut] = []

    class Config:
        from_attributes = True


class AuditRequest(BaseModel):
    audited_by: int


# ============================================================
# Helper
# ============================================================

def _generate_bill_no(db: Session) -> str:
    today_str = date.today().strftime("%Y%m%d")
    prefix = f"PAY-{today_str}-"
    count = db.query(Payment).filter(
        Payment.bill_no.like(f"{prefix}%")
    ).count()
    return f"{prefix}{count + 1:03d}"


# ============================================================
# Endpoints
# ============================================================

@router.get("/", response_model=List[PaymentOut])
def list_payments(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    supplier_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """付款单列表"""
    query = db.query(Payment)
    if search:
        query = query.filter(
            or_(
                Payment.bill_no.contains(search),
                Payment.remark.contains(search),
            )
        )
    if status:
        query = query.filter(Payment.status == status)
    if supplier_id:
        query = query.filter(Payment.supplier_id == supplier_id)
    query = query.order_by(Payment.id.desc())
    return query.offset(skip).limit(limit).all()


@router.get("/{payment_id}", response_model=PaymentOut)
def get_payment(payment_id: int, db: Session = Depends(get_db)):
    """获取付款单详情"""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="付款单不存在")
    return payment


@router.post("/", response_model=PaymentOut)
def create_payment(data: PaymentCreate, db: Session = Depends(get_db)):
    """新增付款单"""
    if not data.items:
        raise HTTPException(status_code=400, detail="至少需要一条核销明细")
    bill_no = _generate_bill_no(db)
    total_amount = sum(item.this_payment for item in data.items)
    payment = Payment(
        bill_no=bill_no,
        bill_date=data.bill_date,
        supplier_id=data.supplier_id,
        payment_method=data.payment_method,
        bank_account=data.bank_account,
        total_amount=total_amount,
        status="draft",
        remark=data.remark,
    )
    db.add(payment)
    db.flush()

    for item_data in data.items:
        payable = db.query(Payable).filter(Payable.id == item_data.payable_id).first()
        item = PaymentItem(
            payment_id=payment.id,
            payable_id=item_data.payable_id,
            payable_bill_no=item_data.payable_bill_no or (payable.bill_no if payable else None),
            payable_amount=item_data.payable_amount or (payable.amount if payable else None),
            this_payment=item_data.this_payment,
        )
        db.add(item)

    db.commit()
    db.refresh(payment)
    return payment


@router.put("/{payment_id}", response_model=PaymentOut)
def update_payment(payment_id: int, data: PaymentUpdate, db: Session = Depends(get_db)):
    """修改付款单"""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="付款单不存在")
    if payment.status not in ("draft", "submitted"):
        raise HTTPException(status_code=400, detail="已审核的单据不能修改")
    update_data = data.model_dump(exclude_unset=True)
    items_data = update_data.pop("items", None)
    for key, value in update_data.items():
        setattr(payment, key, value)
    if items_data is not None:
        db.query(PaymentItem).filter(
            PaymentItem.payment_id == payment.id
        ).delete()
        total_amount = Decimal("0")
        for item_data in items_data:
            item_obj = PaymentItemCreate(**item_data)
            payable = db.query(Payable).filter(Payable.id == item_obj.payable_id).first()
            item = PaymentItem(
                payment_id=payment.id,
                payable_id=item_obj.payable_id,
                payable_bill_no=item_obj.payable_bill_no or (payable.bill_no if payable else None),
                payable_amount=item_obj.payable_amount or (payable.amount if payable else None),
                this_payment=item_obj.this_payment,
            )
            db.add(item)
            total_amount += item_obj.this_payment
        payment.total_amount = total_amount
    db.commit()
    db.refresh(payment)
    return payment


@router.delete("/{payment_id}")
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    """删除付款单"""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="付款单不存在")
    if payment.status not in ("draft",):
        raise HTTPException(status_code=400, detail="非草稿状态不能删除")
    db.delete(payment)
    db.commit()
    return {"detail": "删除成功"}


@router.post("/{payment_id}/audit", response_model=PaymentOut)
def audit_payment(payment_id: int, data: AuditRequest, db: Session = Depends(get_db)):
    """审核付款单

    审核时执行:
    1. 更新应付账款的已付金额和余额
    2. 更新应付账款状态 (paid/partial)
    """
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="付款单不存在")
    if payment.status not in ("draft", "submitted"):
        raise HTTPException(status_code=400, detail="当前状态不能审核")

    # 遍历核销明细，更新应付账款
    for item in payment.items:
        payable = db.query(Payable).filter(Payable.id == item.payable_id).first()
        if payable:
            payable.paid_amount = (payable.paid_amount or Decimal("0")) + item.this_payment
            payable.balance = (payable.amount or Decimal("0")) - payable.paid_amount
            if payable.balance <= 0:
                payable.status = "paid"
            elif payable.paid_amount > 0:
                payable.status = "partial"

    payment.status = "audited"
    payment.audited_by = data.audited_by
    payment.audited_at = datetime.now()
    db.commit()
    db.refresh(payment)
    return payment

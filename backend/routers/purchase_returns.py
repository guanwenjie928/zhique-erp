"""采购退货路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel
from decimal import Decimal

from database import get_db
from models import (
    PurchaseReturn, PurchaseReturnItem,
    Supplier, Warehouse, PurchaseReceipt,
    Inventory, StockMovement, Payable,
)

router = APIRouter()


# ============================================================
# Pydantic Schemas
# ============================================================

class ReturnItemBase(BaseModel):
    material_id: int
    return_quantity: Decimal
    unit_price: Optional[Decimal] = Decimal("0")
    remark: Optional[str] = None


class ReturnItemCreate(ReturnItemBase):
    pass


class ReturnItemOut(ReturnItemBase):
    id: int
    return_id: int
    amount: Optional[Decimal] = Decimal("0")

    class Config:
        from_attributes = True


class ReturnBase(BaseModel):
    bill_date: date
    supplier_id: int
    receipt_id: Optional[int] = None
    receipt_no: Optional[str] = None
    warehouse_id: int
    return_reason: Optional[str] = None
    remark: Optional[str] = None


class ReturnCreate(ReturnBase):
    items: List[ReturnItemCreate]


class ReturnUpdate(BaseModel):
    bill_date: Optional[date] = None
    supplier_id: Optional[int] = None
    receipt_id: Optional[int] = None
    receipt_no: Optional[str] = None
    warehouse_id: Optional[int] = None
    return_reason: Optional[str] = None
    status: Optional[str] = None
    remark: Optional[str] = None
    items: Optional[List[ReturnItemCreate]] = None


class ReturnOut(ReturnBase):
    id: int
    bill_no: str
    total_quantity: Optional[Decimal] = Decimal("0")
    total_amount: Optional[Decimal] = Decimal("0")
    status: str
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    audited_by: Optional[int] = None
    audited_at: Optional[datetime] = None
    items: List[ReturnItemOut] = []

    class Config:
        from_attributes = True


class AuditRequest(BaseModel):
    audited_by: int


# ============================================================
# Helper
# ============================================================

def _generate_bill_no(db: Session) -> str:
    today_str = date.today().strftime("%Y%m%d")
    prefix = f"PRT-{today_str}-"
    count = db.query(PurchaseReturn).filter(
        PurchaseReturn.bill_no.like(f"{prefix}%")
    ).count()
    return f"{prefix}{count + 1:03d}"


# ============================================================
# Endpoints
# ============================================================

@router.get("/", response_model=List[ReturnOut])
def list_returns(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    supplier_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """采购退货列表"""
    query = db.query(PurchaseReturn)
    if search:
        query = query.filter(
            or_(
                PurchaseReturn.bill_no.contains(search),
                PurchaseReturn.receipt_no.contains(search),
                PurchaseReturn.return_reason.contains(search),
            )
        )
    if status:
        query = query.filter(PurchaseReturn.status == status)
    if supplier_id:
        query = query.filter(PurchaseReturn.supplier_id == supplier_id)
    query = query.order_by(PurchaseReturn.id.desc())
    return query.offset(skip).limit(limit).all()


@router.get("/{return_id}", response_model=ReturnOut)
def get_return(return_id: int, db: Session = Depends(get_db)):
    """获取退货单详情"""
    ret = db.query(PurchaseReturn).filter(PurchaseReturn.id == return_id).first()
    if not ret:
        raise HTTPException(status_code=404, detail="退货单不存在")
    return ret


@router.post("/", response_model=ReturnOut)
def create_return(data: ReturnCreate, db: Session = Depends(get_db)):
    """新增采购退货单"""
    if not data.items:
        raise HTTPException(status_code=400, detail="至少需要一条明细")
    bill_no = _generate_bill_no(db)
    ret = PurchaseReturn(
        bill_no=bill_no,
        bill_date=data.bill_date,
        supplier_id=data.supplier_id,
        receipt_id=data.receipt_id,
        receipt_no=data.receipt_no,
        warehouse_id=data.warehouse_id,
        return_reason=data.return_reason,
        status="draft",
        remark=data.remark,
    )
    db.add(ret)
    db.flush()

    total_quantity = Decimal("0")
    total_amount = Decimal("0")
    for item_data in data.items:
        qty = item_data.return_quantity
        price = item_data.unit_price or Decimal("0")
        amount = (qty * price).quantize(Decimal("0.01"))
        item = PurchaseReturnItem(
            return_id=ret.id,
            material_id=item_data.material_id,
            return_quantity=qty,
            unit_price=price,
            amount=amount,
            remark=item_data.remark,
        )
        db.add(item)
        total_quantity += qty
        total_amount += amount

    ret.total_quantity = total_quantity
    ret.total_amount = total_amount
    db.commit()
    db.refresh(ret)
    return ret


@router.put("/{return_id}", response_model=ReturnOut)
def update_return(return_id: int, data: ReturnUpdate, db: Session = Depends(get_db)):
    """修改退货单"""
    ret = db.query(PurchaseReturn).filter(PurchaseReturn.id == return_id).first()
    if not ret:
        raise HTTPException(status_code=404, detail="退货单不存在")
    if ret.status not in ("draft", "submitted"):
        raise HTTPException(status_code=400, detail="已审核的单据不能修改")
    update_data = data.model_dump(exclude_unset=True)
    items_data = update_data.pop("items", None)
    for key, value in update_data.items():
        setattr(ret, key, value)
    if items_data is not None:
        db.query(PurchaseReturnItem).filter(
            PurchaseReturnItem.return_id == ret.id
        ).delete()
        total_quantity = Decimal("0")
        total_amount = Decimal("0")
        for item_data in items_data:
            item_obj = ReturnItemCreate(**item_data)
            qty = item_obj.return_quantity
            price = item_obj.unit_price or Decimal("0")
            amount = (qty * price).quantize(Decimal("0.01"))
            item = PurchaseReturnItem(
                return_id=ret.id,
                material_id=item_obj.material_id,
                return_quantity=qty,
                unit_price=price,
                amount=amount,
                remark=item_obj.remark,
            )
            db.add(item)
            total_quantity += qty
            total_amount += amount
        ret.total_quantity = total_quantity
        ret.total_amount = total_amount
    db.commit()
    db.refresh(ret)
    return ret


@router.delete("/{return_id}")
def delete_return(return_id: int, db: Session = Depends(get_db)):
    """删除退货单"""
    ret = db.query(PurchaseReturn).filter(PurchaseReturn.id == return_id).first()
    if not ret:
        raise HTTPException(status_code=404, detail="退货单不存在")
    if ret.status not in ("draft",):
        raise HTTPException(status_code=400, detail="非草稿状态不能删除")
    db.delete(ret)
    db.commit()
    return {"detail": "删除成功"}


@router.post("/{return_id}/audit", response_model=ReturnOut)
def audit_return(return_id: int, data: AuditRequest, db: Session = Depends(get_db)):
    """审核采购退货单

    审核时执行:
    1. 减少库存 (Inventory)
    2. 创建出库流水 (StockMovement)
    3. 减少应付账款 (Payable) - 冲减对应入库单的应付
    """
    ret = db.query(PurchaseReturn).filter(PurchaseReturn.id == return_id).first()
    if not ret:
        raise HTTPException(status_code=404, detail="退货单不存在")
    if ret.status not in ("draft", "submitted"):
        raise HTTPException(status_code=400, detail="当前状态不能审核")

    for item in ret.items:
        qty = item.return_quantity
        unit_cost = item.unit_price or Decimal("0")

        # 1. 减少库存
        inv = db.query(Inventory).filter(
            Inventory.material_id == item.material_id,
            Inventory.warehouse_id == ret.warehouse_id,
        ).first()
        if inv:
            inv.quantity = (inv.quantity or Decimal("0")) - qty
            inv.last_out_date = datetime.now()
        else:
            # 库存不存在时创建负库存记录
            inv = Inventory(
                material_id=item.material_id,
                warehouse_id=ret.warehouse_id,
                quantity=-qty,
                locked_quantity=Decimal("0"),
                average_cost=unit_cost,
                last_out_date=datetime.now(),
            )
            db.add(inv)

        # 2. 创建出库流水
        movement = StockMovement(
            material_id=item.material_id,
            warehouse_id=ret.warehouse_id,
            movement_type="out",
            source_type="purchase_return",
            source_bill_no=ret.bill_no,
            quantity=-qty,
            unit_cost=unit_cost,
            balance_quantity=inv.quantity,
            movement_date=datetime.now(),
            remark=f"采购退货-{ret.bill_no}",
        )
        db.add(movement)

    # 3. 减少应付账款
    if ret.receipt_no:
        payable = db.query(Payable).filter(
            Payable.bill_no == ret.receipt_no,
            Payable.supplier_id == ret.supplier_id,
        ).first()
        if payable:
            payable.amount = (payable.amount or Decimal("0")) - (ret.total_amount or Decimal("0"))
            payable.balance = (payable.balance or Decimal("0")) - (ret.total_amount or Decimal("0"))
            if payable.balance <= 0:
                payable.status = "paid"
            else:
                payable.status = "partial"
        else:
            # 没有对应应付记录，创建一条冲减记录
            payable = Payable(
                supplier_id=ret.supplier_id,
                bill_type="purchase_return",
                bill_no=ret.bill_no,
                bill_date=ret.bill_date,
                amount=-(ret.total_amount or Decimal("0")),
                paid_amount=Decimal("0"),
                balance=-(ret.total_amount or Decimal("0")),
                status="paid",
                remark=f"采购退货冲减-{ret.bill_no}",
            )
            db.add(payable)
    else:
        # 无关联入库单，直接创建冲减应付
        payable = Payable(
            supplier_id=ret.supplier_id,
            bill_type="purchase_return",
            bill_no=ret.bill_no,
            bill_date=ret.bill_date,
            amount=-(ret.total_amount or Decimal("0")),
            paid_amount=Decimal("0"),
            balance=-(ret.total_amount or Decimal("0")),
            status="paid",
            remark=f"采购退货冲减-{ret.bill_no}",
        )
        db.add(payable)

    ret.status = "audited"
    ret.audited_by = data.audited_by
    ret.audited_at = datetime.now()

    db.commit()
    db.refresh(ret)
    return ret

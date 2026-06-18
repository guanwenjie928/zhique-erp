"""销售退货路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel
from decimal import Decimal

from database import get_db
from models import (
    SalesReturn, SalesReturnItem,
    Customer, Warehouse,
    Inventory, StockMovement, Receivable,
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
    customer_id: int
    warehouse_id: int
    return_reason: Optional[str] = None
    remark: Optional[str] = None


class ReturnCreate(ReturnBase):
    items: List[ReturnItemCreate]


class ReturnUpdate(BaseModel):
    bill_date: Optional[date] = None
    customer_id: Optional[int] = None
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
    prefix = f"SRT-{today_str}-"
    count = db.query(SalesReturn).filter(
        SalesReturn.bill_no.like(f"{prefix}%")
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
    customer_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """销售退货列表"""
    query = db.query(SalesReturn)
    if search:
        query = query.filter(
            or_(
                SalesReturn.bill_no.contains(search),
                SalesReturn.return_reason.contains(search),
            )
        )
    if status:
        query = query.filter(SalesReturn.status == status)
    if customer_id:
        query = query.filter(SalesReturn.customer_id == customer_id)
    query = query.order_by(SalesReturn.id.desc())
    return query.offset(skip).limit(limit).all()


@router.get("/{return_id}", response_model=ReturnOut)
def get_return(return_id: int, db: Session = Depends(get_db)):
    """获取退货单详情"""
    ret = db.query(SalesReturn).filter(SalesReturn.id == return_id).first()
    if not ret:
        raise HTTPException(status_code=404, detail="退货单不存在")
    return ret


@router.post("/", response_model=ReturnOut)
def create_return(data: ReturnCreate, db: Session = Depends(get_db)):
    """新增销售退货单"""
    if not data.items:
        raise HTTPException(status_code=400, detail="至少需要一条明细")
    bill_no = _generate_bill_no(db)
    ret = SalesReturn(
        bill_no=bill_no,
        bill_date=data.bill_date,
        customer_id=data.customer_id,
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
        item = SalesReturnItem(
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
    ret = db.query(SalesReturn).filter(SalesReturn.id == return_id).first()
    if not ret:
        raise HTTPException(status_code=404, detail="退货单不存在")
    if ret.status not in ("draft", "submitted"):
        raise HTTPException(status_code=400, detail="已审核的单据不能修改")
    update_data = data.model_dump(exclude_unset=True)
    items_data = update_data.pop("items", None)
    for key, value in update_data.items():
        setattr(ret, key, value)
    if items_data is not None:
        db.query(SalesReturnItem).filter(
            SalesReturnItem.return_id == ret.id
        ).delete()
        total_quantity = Decimal("0")
        total_amount = Decimal("0")
        for item_data in items_data:
            item_obj = ReturnItemCreate(**item_data)
            qty = item_obj.return_quantity
            price = item_obj.unit_price or Decimal("0")
            amount = (qty * price).quantize(Decimal("0.01"))
            item = SalesReturnItem(
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
    ret = db.query(SalesReturn).filter(SalesReturn.id == return_id).first()
    if not ret:
        raise HTTPException(status_code=404, detail="退货单不存在")
    if ret.status not in ("draft",):
        raise HTTPException(status_code=400, detail="非草稿状态不能删除")
    db.delete(ret)
    db.commit()
    return {"detail": "删除成功"}


@router.post("/{return_id}/audit", response_model=ReturnOut)
def audit_return(return_id: int, data: AuditRequest, db: Session = Depends(get_db)):
    """审核销售退货单

    审核时执行:
    1. 增加库存 (Inventory)
    2. 创建入库流水 (StockMovement)
    3. 冲减应收账款 (Receivable)
    """
    ret = db.query(SalesReturn).filter(SalesReturn.id == return_id).first()
    if not ret:
        raise HTTPException(status_code=404, detail="退货单不存在")
    if ret.status not in ("draft", "submitted"):
        raise HTTPException(status_code=400, detail="当前状态不能审核")

    for item in ret.items:
        qty = item.return_quantity
        unit_cost = item.unit_price or Decimal("0")

        # 1. 增加库存
        inv = db.query(Inventory).filter(
            Inventory.material_id == item.material_id,
            Inventory.warehouse_id == ret.warehouse_id,
        ).first()
        if inv:
            old_qty = inv.quantity or Decimal("0")
            old_cost = inv.average_cost or Decimal("0")
            new_qty = old_qty + qty
            if new_qty > 0:
                new_avg_cost = ((old_qty * old_cost + qty * unit_cost) / new_qty).quantize(Decimal("0.0001"))
            else:
                new_avg_cost = old_cost
            inv.quantity = new_qty
            inv.average_cost = new_avg_cost
            inv.last_in_date = datetime.now()
        else:
            inv = Inventory(
                material_id=item.material_id,
                warehouse_id=ret.warehouse_id,
                quantity=qty,
                locked_quantity=Decimal("0"),
                average_cost=unit_cost,
                last_in_date=datetime.now(),
            )
            db.add(inv)

        # 2. 创建入库流水
        movement = StockMovement(
            material_id=item.material_id,
            warehouse_id=ret.warehouse_id,
            movement_type="in",
            source_type="sales_return",
            source_bill_no=ret.bill_no,
            quantity=qty,
            unit_cost=unit_cost,
            balance_quantity=inv.quantity,
            movement_date=datetime.now(),
            remark=f"销售退货-{ret.bill_no}",
        )
        db.add(movement)

    # 3. 冲减应收账款
    receivable = Receivable(
        customer_id=ret.customer_id,
        bill_type="sales_return",
        bill_no=ret.bill_no,
        bill_date=ret.bill_date,
        amount=-(ret.total_amount or Decimal("0")),
        received_amount=Decimal("0"),
        balance=-(ret.total_amount or Decimal("0")),
        status="paid",
        remark=f"销售退货冲减-{ret.bill_no}",
    )
    db.add(receivable)

    ret.status = "audited"
    db.commit()
    db.refresh(ret)
    return ret

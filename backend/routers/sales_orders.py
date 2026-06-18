"""销售订单路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel
from decimal import Decimal

from database import get_db
from models import SalesOrder, SalesOrderItem, Customer, Material

router = APIRouter()


# ============================================================
# Pydantic Schemas
# ============================================================

class SOItemBase(BaseModel):
    material_id: int
    quantity: Decimal
    unit_price: Decimal
    tax_rate: Optional[Decimal] = Decimal("0.13")
    remark: Optional[str] = None


class SOItemCreate(SOItemBase):
    pass


class SOItemOut(SOItemBase):
    id: int
    order_id: int
    amount: Optional[Decimal] = Decimal("0")
    tax_amount: Optional[Decimal] = Decimal("0")
    total_amount: Optional[Decimal] = Decimal("0")
    delivered_quantity: Optional[Decimal] = Decimal("0")

    class Config:
        from_attributes = True


class SOBase(BaseModel):
    bill_date: date
    customer_id: int
    salesperson_id: Optional[int] = None
    currency: Optional[str] = "CNY"
    payment_terms: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    delivery_address: Optional[str] = None
    remark: Optional[str] = None


class SOCreate(SOBase):
    items: List[SOItemCreate]


class SOUpdate(BaseModel):
    bill_date: Optional[date] = None
    customer_id: Optional[int] = None
    salesperson_id: Optional[int] = None
    currency: Optional[str] = None
    payment_terms: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    delivery_address: Optional[str] = None
    status: Optional[str] = None
    remark: Optional[str] = None
    items: Optional[List[SOItemCreate]] = None


class SOOut(SOBase):
    id: int
    bill_no: str
    total_amount: Optional[Decimal] = Decimal("0")
    total_tax: Optional[Decimal] = Decimal("0")
    total_amount_with_tax: Optional[Decimal] = Decimal("0")
    status: str
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    audited_by: Optional[int] = None
    audited_at: Optional[datetime] = None
    items: List[SOItemOut] = []

    class Config:
        from_attributes = True


class AuditRequest(BaseModel):
    audited_by: int


# ============================================================
# Helper
# ============================================================

def _generate_bill_no(db: Session) -> str:
    today_str = date.today().strftime("%Y%m%d")
    prefix = f"SO-{today_str}-"
    count = db.query(SalesOrder).filter(
        SalesOrder.bill_no.like(f"{prefix}%")
    ).count()
    return f"{prefix}{count + 1:03d}"


def _calc_item_amounts(item_data: SOItemCreate) -> dict:
    amount = (item_data.quantity * item_data.unit_price).quantize(Decimal("0.01"))
    tax_amount = (amount * item_data.tax_rate).quantize(Decimal("0.01"))
    total = (amount + tax_amount).quantize(Decimal("0.01"))
    return {"amount": amount, "tax_amount": tax_amount, "total_amount": total}


# ============================================================
# Endpoints
# ============================================================

@router.get("/", response_model=List[SOOut])
def list_sales_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """销售订单列表"""
    query = db.query(SalesOrder)
    if search:
        query = query.filter(
            or_(
                SalesOrder.bill_no.contains(search),
                SalesOrder.remark.contains(search),
            )
        )
    if status:
        query = query.filter(SalesOrder.status == status)
    if customer_id:
        query = query.filter(SalesOrder.customer_id == customer_id)
    query = query.order_by(SalesOrder.id.desc())
    return query.offset(skip).limit(limit).all()


@router.get("/{so_id}", response_model=SOOut)
def get_sales_order(so_id: int, db: Session = Depends(get_db)):
    """获取销售订单详情"""
    so = db.query(SalesOrder).filter(SalesOrder.id == so_id).first()
    if not so:
        raise HTTPException(status_code=404, detail="销售订单不存在")
    return so


@router.post("/", response_model=SOOut)
def create_sales_order(data: SOCreate, db: Session = Depends(get_db)):
    """新增销售订单"""
    if not data.items:
        raise HTTPException(status_code=400, detail="至少需要一条明细")
    customer = db.query(Customer).filter(Customer.id == data.customer_id).first()
    if not customer:
        raise HTTPException(status_code=400, detail="客户不存在")
    bill_no = _generate_bill_no(db)
    so = SalesOrder(
        bill_no=bill_no,
        bill_date=data.bill_date,
        customer_id=data.customer_id,
        salesperson_id=data.salesperson_id,
        currency=data.currency,
        payment_terms=data.payment_terms or customer.payment_terms,
        expected_delivery_date=data.expected_delivery_date,
        delivery_address=data.delivery_address,
        status="draft",
        remark=data.remark,
    )
    db.add(so)
    db.flush()

    total_amount = Decimal("0")
    total_tax = Decimal("0")
    total_with_tax = Decimal("0")
    for item_data in data.items:
        material = db.query(Material).filter(Material.id == item_data.material_id).first()
        if not material:
            raise HTTPException(status_code=400, detail=f"物料ID {item_data.material_id} 不存在")
        amounts = _calc_item_amounts(item_data)
        item = SalesOrderItem(
            order_id=so.id,
            material_id=item_data.material_id,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            tax_rate=item_data.tax_rate,
            amount=amounts["amount"],
            tax_amount=amounts["tax_amount"],
            total_amount=amounts["total_amount"],
            remark=item_data.remark,
        )
        db.add(item)
        total_amount += amounts["amount"]
        total_tax += amounts["tax_amount"]
        total_with_tax += amounts["total_amount"]

    so.total_amount = total_amount
    so.total_tax = total_tax
    so.total_amount_with_tax = total_with_tax
    db.commit()
    db.refresh(so)
    return so


@router.put("/{so_id}", response_model=SOOut)
def update_sales_order(so_id: int, data: SOUpdate, db: Session = Depends(get_db)):
    """修改销售订单"""
    so = db.query(SalesOrder).filter(SalesOrder.id == so_id).first()
    if not so:
        raise HTTPException(status_code=404, detail="销售订单不存在")
    if so.status not in ("draft", "submitted"):
        raise HTTPException(status_code=400, detail="已审核的单据不能修改")
    update_data = data.model_dump(exclude_unset=True)
    items_data = update_data.pop("items", None)
    for key, value in update_data.items():
        setattr(so, key, value)
    if items_data is not None:
        db.query(SalesOrderItem).filter(
            SalesOrderItem.order_id == so.id
        ).delete()
        total_amount = Decimal("0")
        total_tax = Decimal("0")
        total_with_tax = Decimal("0")
        for item_data in items_data:
            item_obj = SOItemCreate(**item_data)
            amounts = _calc_item_amounts(item_obj)
            item = SalesOrderItem(
                order_id=so.id,
                material_id=item_obj.material_id,
                quantity=item_obj.quantity,
                unit_price=item_obj.unit_price,
                tax_rate=item_obj.tax_rate,
                amount=amounts["amount"],
                tax_amount=amounts["tax_amount"],
                total_amount=amounts["total_amount"],
                remark=item_obj.remark,
            )
            db.add(item)
            total_amount += amounts["amount"]
            total_tax += amounts["tax_amount"]
            total_with_tax += amounts["total_amount"]
        so.total_amount = total_amount
        so.total_tax = total_tax
        so.total_amount_with_tax = total_with_tax
    db.commit()
    db.refresh(so)
    return so


@router.delete("/{so_id}")
def delete_sales_order(so_id: int, db: Session = Depends(get_db)):
    """删除销售订单"""
    so = db.query(SalesOrder).filter(SalesOrder.id == so_id).first()
    if not so:
        raise HTTPException(status_code=404, detail="销售订单不存在")
    if so.status not in ("draft",):
        raise HTTPException(status_code=400, detail="非草稿状态不能删除")
    db.delete(so)
    db.commit()
    return {"detail": "删除成功"}


@router.post("/{so_id}/audit", response_model=SOOut)
def audit_sales_order(so_id: int, data: AuditRequest, db: Session = Depends(get_db)):
    """审核销售订单"""
    so = db.query(SalesOrder).filter(SalesOrder.id == so_id).first()
    if not so:
        raise HTTPException(status_code=404, detail="销售订单不存在")
    if so.status not in ("draft", "submitted"):
        raise HTTPException(status_code=400, detail="当前状态不能审核")
    so.status = "audited"
    so.audited_by = data.audited_by
    so.audited_at = datetime.now()
    db.commit()
    db.refresh(so)
    return so

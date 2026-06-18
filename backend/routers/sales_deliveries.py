"""销售出库路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel
from decimal import Decimal

from database import get_db
from models import (
    SalesDelivery, SalesDeliveryItem,
    Customer, Warehouse, SalesOrder, SalesOrderItem,
    Inventory, StockMovement, Receivable,
)

router = APIRouter()


# ============================================================
# Pydantic Schemas
# ============================================================

class DeliveryItemBase(BaseModel):
    material_id: int
    order_item_id: Optional[int] = None
    order_quantity: Optional[Decimal] = None
    delivered_quantity: Decimal
    unit_price: Optional[Decimal] = Decimal("0")
    remark: Optional[str] = None


class DeliveryItemCreate(DeliveryItemBase):
    pass


class DeliveryItemOut(DeliveryItemBase):
    id: int
    delivery_id: int
    amount: Optional[Decimal] = Decimal("0")

    class Config:
        from_attributes = True


class DeliveryBase(BaseModel):
    bill_date: date
    customer_id: int
    order_id: Optional[int] = None
    order_no: Optional[str] = None
    warehouse_id: int
    remark: Optional[str] = None


class DeliveryCreate(DeliveryBase):
    items: List[DeliveryItemCreate]


class DeliveryUpdate(BaseModel):
    bill_date: Optional[date] = None
    customer_id: Optional[int] = None
    order_id: Optional[int] = None
    order_no: Optional[str] = None
    warehouse_id: Optional[int] = None
    status: Optional[str] = None
    remark: Optional[str] = None
    items: Optional[List[DeliveryItemCreate]] = None


class DeliveryOut(DeliveryBase):
    id: int
    bill_no: str
    total_quantity: Optional[Decimal] = Decimal("0")
    total_amount: Optional[Decimal] = Decimal("0")
    status: str
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    audited_by: Optional[int] = None
    audited_at: Optional[datetime] = None
    items: List[DeliveryItemOut] = []

    class Config:
        from_attributes = True


class AuditRequest(BaseModel):
    audited_by: int


# ============================================================
# Helper
# ============================================================

def _generate_bill_no(db: Session) -> str:
    today_str = date.today().strftime("%Y%m%d")
    prefix = f"SD-{today_str}-"
    count = db.query(SalesDelivery).filter(
        SalesDelivery.bill_no.like(f"{prefix}%")
    ).count()
    return f"{prefix}{count + 1:03d}"


# ============================================================
# Endpoints
# ============================================================

@router.get("/", response_model=List[DeliveryOut])
def list_deliveries(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    warehouse_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """销售出库列表"""
    query = db.query(SalesDelivery)
    if search:
        query = query.filter(
            or_(
                SalesDelivery.bill_no.contains(search),
                SalesDelivery.order_no.contains(search),
            )
        )
    if status:
        query = query.filter(SalesDelivery.status == status)
    if customer_id:
        query = query.filter(SalesDelivery.customer_id == customer_id)
    if warehouse_id:
        query = query.filter(SalesDelivery.warehouse_id == warehouse_id)
    query = query.order_by(SalesDelivery.id.desc())
    return query.offset(skip).limit(limit).all()


@router.get("/{delivery_id}", response_model=DeliveryOut)
def get_delivery(delivery_id: int, db: Session = Depends(get_db)):
    """获取出库单详情"""
    delivery = db.query(SalesDelivery).filter(SalesDelivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="出库单不存在")
    return delivery


@router.post("/", response_model=DeliveryOut)
def create_delivery(data: DeliveryCreate, db: Session = Depends(get_db)):
    """新增销售出库单"""
    if not data.items:
        raise HTTPException(status_code=400, detail="至少需要一条明细")
    bill_no = _generate_bill_no(db)
    delivery = SalesDelivery(
        bill_no=bill_no,
        bill_date=data.bill_date,
        customer_id=data.customer_id,
        order_id=data.order_id,
        order_no=data.order_no,
        warehouse_id=data.warehouse_id,
        status="draft",
        remark=data.remark,
    )
    db.add(delivery)
    db.flush()

    total_quantity = Decimal("0")
    total_amount = Decimal("0")
    for item_data in data.items:
        qty = item_data.delivered_quantity
        price = item_data.unit_price or Decimal("0")
        amount = (qty * price).quantize(Decimal("0.01"))
        item = SalesDeliveryItem(
            delivery_id=delivery.id,
            material_id=item_data.material_id,
            order_item_id=item_data.order_item_id,
            order_quantity=item_data.order_quantity,
            delivered_quantity=qty,
            unit_price=price,
            amount=amount,
            remark=item_data.remark,
        )
        db.add(item)
        total_quantity += qty
        total_amount += amount

    delivery.total_quantity = total_quantity
    delivery.total_amount = total_amount
    db.commit()
    db.refresh(delivery)
    return delivery


@router.put("/{delivery_id}", response_model=DeliveryOut)
def update_delivery(delivery_id: int, data: DeliveryUpdate, db: Session = Depends(get_db)):
    """修改出库单"""
    delivery = db.query(SalesDelivery).filter(SalesDelivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="出库单不存在")
    if delivery.status not in ("draft", "submitted"):
        raise HTTPException(status_code=400, detail="已审核的单据不能修改")
    update_data = data.model_dump(exclude_unset=True)
    items_data = update_data.pop("items", None)
    for key, value in update_data.items():
        setattr(delivery, key, value)
    if items_data is not None:
        db.query(SalesDeliveryItem).filter(
            SalesDeliveryItem.delivery_id == delivery.id
        ).delete()
        total_quantity = Decimal("0")
        total_amount = Decimal("0")
        for item_data in items_data:
            item_obj = DeliveryItemCreate(**item_data)
            qty = item_obj.delivered_quantity
            price = item_obj.unit_price or Decimal("0")
            amount = (qty * price).quantize(Decimal("0.01"))
            item = SalesDeliveryItem(
                delivery_id=delivery.id,
                material_id=item_obj.material_id,
                order_item_id=item_obj.order_item_id,
                order_quantity=item_obj.order_quantity,
                delivered_quantity=qty,
                unit_price=price,
                amount=amount,
                remark=item_obj.remark,
            )
            db.add(item)
            total_quantity += qty
            total_amount += amount
        delivery.total_quantity = total_quantity
        delivery.total_amount = total_amount
    db.commit()
    db.refresh(delivery)
    return delivery


@router.delete("/{delivery_id}")
def delete_delivery(delivery_id: int, db: Session = Depends(get_db)):
    """删除出库单"""
    delivery = db.query(SalesDelivery).filter(SalesDelivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="出库单不存在")
    if delivery.status not in ("draft",):
        raise HTTPException(status_code=400, detail="非草稿状态不能删除")
    db.delete(delivery)
    db.commit()
    return {"detail": "删除成功"}


@router.post("/{delivery_id}/audit", response_model=DeliveryOut)
def audit_delivery(delivery_id: int, data: AuditRequest, db: Session = Depends(get_db)):
    """审核销售出库单

    审核时执行:
    1. 减少库存 (Inventory)
    2. 创建出库流水 (StockMovement)
    3. 更新销售订单明细已出库数量
    4. 创建应收账款 (Receivable)
    """
    delivery = db.query(SalesDelivery).filter(SalesDelivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="出库单不存在")
    if delivery.status not in ("draft", "submitted"):
        raise HTTPException(status_code=400, detail="当前状态不能审核")

    for item in delivery.items:
        qty = item.delivered_quantity
        unit_cost = item.unit_price or Decimal("0")

        # 1. 减少库存
        inv = db.query(Inventory).filter(
            Inventory.material_id == item.material_id,
            Inventory.warehouse_id == delivery.warehouse_id,
        ).first()
        if inv:
            inv.quantity = (inv.quantity or Decimal("0")) - qty
            inv.last_out_date = datetime.now()
        else:
            inv = Inventory(
                material_id=item.material_id,
                warehouse_id=delivery.warehouse_id,
                quantity=-qty,
                locked_quantity=Decimal("0"),
                average_cost=unit_cost,
                last_out_date=datetime.now(),
            )
            db.add(inv)

        # 2. 创建出库流水
        movement = StockMovement(
            material_id=item.material_id,
            warehouse_id=delivery.warehouse_id,
            movement_type="out",
            source_type="sales_delivery",
            source_bill_no=delivery.bill_no,
            quantity=-qty,
            unit_cost=inv.average_cost if inv else unit_cost,
            balance_quantity=inv.quantity,
            movement_date=datetime.now(),
            remark=f"销售出库-{delivery.bill_no}",
        )
        db.add(movement)

        # 3. 更新销售订单明细已出库数量
        if item.order_item_id:
            so_item = db.query(SalesOrderItem).filter(
                SalesOrderItem.id == item.order_item_id
            ).first()
            if so_item:
                so_item.delivered_quantity = (so_item.delivered_quantity or Decimal("0")) + qty

    # 更新销售订单状态
    if delivery.order_id:
        so = db.query(SalesOrder).filter(SalesOrder.id == delivery.order_id).first()
        if so:
            all_delivered = True
            any_delivered = False
            for so_item in so.items:
                if (so_item.delivered_quantity or Decimal("0")) >= so_item.quantity:
                    any_delivered = True
                elif (so_item.delivered_quantity or Decimal("0")) > 0:
                    any_delivered = True
                    all_delivered = False
                else:
                    all_delivered = False
            if all_delivered:
                so.status = "delivered"
            elif any_delivered:
                so.status = "partial_delivery"

    # 4. 创建应收账款
    receivable = Receivable(
        customer_id=delivery.customer_id,
        bill_type="sales_delivery",
        bill_no=delivery.bill_no,
        bill_date=delivery.bill_date,
        amount=delivery.total_amount or Decimal("0"),
        received_amount=Decimal("0"),
        balance=delivery.total_amount or Decimal("0"),
        status="unpaid",
        remark=f"销售出库-{delivery.bill_no}",
    )
    db.add(receivable)

    delivery.status = "audited"
    delivery.audited_by = data.audited_by
    delivery.audited_at = datetime.now()

    db.commit()
    db.refresh(delivery)
    return delivery

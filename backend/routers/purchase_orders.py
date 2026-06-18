"""采购订单路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel
from decimal import Decimal

from database import get_db
from models import (
    PurchaseOrder, PurchaseOrderItem,
    PurchaseReceipt, PurchaseReceiptItem,
    Material, Supplier,
)

router = APIRouter()


# ============================================================
# Pydantic Schemas
# ============================================================

class POItemBase(BaseModel):
    material_id: int
    quantity: Decimal
    unit_price: Decimal
    tax_rate: Optional[Decimal] = Decimal("0.13")
    remark: Optional[str] = None


class POItemCreate(POItemBase):
    pass


class POItemOut(POItemBase):
    id: int
    order_id: int
    amount: Optional[Decimal] = Decimal("0")
    tax_amount: Optional[Decimal] = Decimal("0")
    total_amount: Optional[Decimal] = Decimal("0")
    received_quantity: Optional[Decimal] = Decimal("0")
    source_request_item_id: Optional[int] = None

    class Config:
        from_attributes = True


class POBase(BaseModel):
    bill_date: date
    supplier_id: int
    department_id: Optional[int] = None
    buyer_id: Optional[int] = None
    currency: Optional[str] = "CNY"
    payment_terms: Optional[str] = None
    expected_date: Optional[date] = None
    delivery_address: Optional[str] = None
    remark: Optional[str] = None


class POCreate(POBase):
    items: List[POItemCreate]


class POUpdate(BaseModel):
    bill_date: Optional[date] = None
    supplier_id: Optional[int] = None
    department_id: Optional[int] = None
    buyer_id: Optional[int] = None
    currency: Optional[str] = None
    payment_terms: Optional[str] = None
    expected_date: Optional[date] = None
    delivery_address: Optional[str] = None
    status: Optional[str] = None
    remark: Optional[str] = None
    items: Optional[List[POItemCreate]] = None


class POOut(POBase):
    id: int
    bill_no: str
    total_amount: Optional[Decimal] = Decimal("0")
    total_tax: Optional[Decimal] = Decimal("0")
    total_amount_with_tax: Optional[Decimal] = Decimal("0")
    status: str
    source_bill_type: Optional[str] = None
    source_bill_no: Optional[str] = None
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    audited_by: Optional[int] = None
    audited_at: Optional[datetime] = None
    items: List[POItemOut] = []

    class Config:
        from_attributes = True


class AuditRequest(BaseModel):
    audited_by: int


class PushDownItem(BaseModel):
    order_item_id: int
    received_quantity: Decimal


class PushDownRequest(BaseModel):
    warehouse_id: int
    bill_date: date
    receiver_id: Optional[int] = None
    items: List[PushDownItem]
    remark: Optional[str] = None


# ============================================================
# Helper
# ============================================================

def _generate_bill_no(db: Session) -> str:
    today_str = date.today().strftime("%Y%m%d")
    prefix = f"PO-{today_str}-"
    count = db.query(PurchaseOrder).filter(
        PurchaseOrder.bill_no.like(f"{prefix}%")
    ).count()
    return f"{prefix}{count + 1:03d}"


def _calc_item_amounts(item_data: POItemCreate) -> dict:
    amount = (item_data.quantity * item_data.unit_price).quantize(Decimal("0.01"))
    tax_amount = (amount * item_data.tax_rate).quantize(Decimal("0.01"))
    total = (amount + tax_amount).quantize(Decimal("0.01"))
    return {"amount": amount, "tax_amount": tax_amount, "total_amount": total}


# ============================================================
# Endpoints
# ============================================================

@router.get("/", response_model=List[POOut])
def list_purchase_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    supplier_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """采购订单列表"""
    query = db.query(PurchaseOrder)
    if search:
        query = query.filter(
            or_(
                PurchaseOrder.bill_no.contains(search),
                PurchaseOrder.source_bill_no.contains(search),
                PurchaseOrder.remark.contains(search),
            )
        )
    if status:
        query = query.filter(PurchaseOrder.status == status)
    if supplier_id:
        query = query.filter(PurchaseOrder.supplier_id == supplier_id)
    query = query.order_by(PurchaseOrder.id.desc())
    return query.offset(skip).limit(limit).all()


@router.get("/{po_id}", response_model=POOut)
def get_purchase_order(po_id: int, db: Session = Depends(get_db)):
    """获取采购订单详情"""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="采购订单不存在")
    return po


@router.post("/", response_model=POOut)
def create_purchase_order(data: POCreate, db: Session = Depends(get_db)):
    """新增采购订单"""
    if not data.items:
        raise HTTPException(status_code=400, detail="至少需要一条明细")
    bill_no = _generate_bill_no(db)
    supplier = db.query(Supplier).filter(Supplier.id == data.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=400, detail="供应商不存在")
    po = PurchaseOrder(
        bill_no=bill_no,
        bill_date=data.bill_date,
        supplier_id=data.supplier_id,
        department_id=data.department_id,
        buyer_id=data.buyer_id,
        currency=data.currency,
        payment_terms=data.payment_terms or supplier.payment_terms,
        expected_date=data.expected_date,
        delivery_address=data.delivery_address,
        status="draft",
        remark=data.remark,
    )
    db.add(po)
    db.flush()

    total_amount = Decimal("0")
    total_tax = Decimal("0")
    total_with_tax = Decimal("0")

    for item_data in data.items:
        material = db.query(Material).filter(Material.id == item_data.material_id).first()
        if not material:
            raise HTTPException(status_code=400, detail=f"物料ID {item_data.material_id} 不存在")
        amounts = _calc_item_amounts(item_data)
        po_item = PurchaseOrderItem(
            order_id=po.id,
            material_id=item_data.material_id,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            tax_rate=item_data.tax_rate,
            amount=amounts["amount"],
            tax_amount=amounts["tax_amount"],
            total_amount=amounts["total_amount"],
            remark=item_data.remark,
        )
        db.add(po_item)
        total_amount += amounts["amount"]
        total_tax += amounts["tax_amount"]
        total_with_tax += amounts["total_amount"]

    po.total_amount = total_amount
    po.total_tax = total_tax
    po.total_amount_with_tax = total_with_tax
    db.commit()
    db.refresh(po)
    return po


@router.put("/{po_id}", response_model=POOut)
def update_purchase_order(po_id: int, data: POUpdate, db: Session = Depends(get_db)):
    """修改采购订单"""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="采购订单不存在")
    if po.status not in ("draft", "submitted"):
        raise HTTPException(status_code=400, detail="已审核的单据不能修改")
    update_data = data.model_dump(exclude_unset=True)
    items_data = update_data.pop("items", None)
    for key, value in update_data.items():
        setattr(po, key, value)
    if items_data is not None:
        db.query(PurchaseOrderItem).filter(
            PurchaseOrderItem.order_id == po.id
        ).delete()
        total_amount = Decimal("0")
        total_tax = Decimal("0")
        total_with_tax = Decimal("0")
        for item_data in items_data:
            item_obj = POItemCreate(**item_data)
            amounts = _calc_item_amounts(item_obj)
            po_item = PurchaseOrderItem(
                order_id=po.id,
                material_id=item_obj.material_id,
                quantity=item_obj.quantity,
                unit_price=item_obj.unit_price,
                tax_rate=item_obj.tax_rate,
                amount=amounts["amount"],
                tax_amount=amounts["tax_amount"],
                total_amount=amounts["total_amount"],
                remark=item_obj.remark,
            )
            db.add(po_item)
            total_amount += amounts["amount"]
            total_tax += amounts["tax_amount"]
            total_with_tax += amounts["total_amount"]
        po.total_amount = total_amount
        po.total_tax = total_tax
        po.total_amount_with_tax = total_with_tax
    db.commit()
    db.refresh(po)
    return po


@router.delete("/{po_id}")
def delete_purchase_order(po_id: int, db: Session = Depends(get_db)):
    """删除采购订单"""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="采购订单不存在")
    if po.status not in ("draft",):
        raise HTTPException(status_code=400, detail="非草稿状态不能删除")
    db.delete(po)
    db.commit()
    return {"detail": "删除成功"}


@router.post("/{po_id}/audit", response_model=POOut)
def audit_purchase_order(po_id: int, data: AuditRequest, db: Session = Depends(get_db)):
    """审核采购订单"""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="采购订单不存在")
    if po.status not in ("draft", "submitted"):
        raise HTTPException(status_code=400, detail="当前状态不能审核")
    po.status = "audited"
    po.audited_by = data.audited_by
    po.audited_at = datetime.now()
    db.commit()
    db.refresh(po)
    return po


@router.post("/{po_id}/push-down", response_model=dict)
def push_down_to_receipt(
    po_id: int,
    data: PushDownRequest,
    db: Session = Depends(get_db),
):
    """采购订单下推生成采购入库单"""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="采购订单不存在")
    if po.status not in ("audited", "partial_receipt"):
        raise HTTPException(status_code=400, detail="只有已审核或部分入库的订单才能下推")

    # 生成入库单编号
    today_str = date.today().strftime("%Y%m%d")
    prefix = f"PI-{today_str}-"
    count = db.query(PurchaseReceipt).filter(
        PurchaseReceipt.bill_no.like(f"{prefix}%")
    ).count()
    receipt_no = f"{prefix}{count + 1:03d}"

    total_quantity = Decimal("0")
    total_amount = Decimal("0")

    receipt = PurchaseReceipt(
        bill_no=receipt_no,
        bill_date=data.bill_date,
        supplier_id=po.supplier_id,
        order_id=po.id,
        order_no=po.bill_no,
        warehouse_id=data.warehouse_id,
        receiver_id=data.receiver_id,
        status="draft",
        source_bill_type="purchase_order",
        remark=data.remark,
    )
    db.add(receipt)
    db.flush()

    for item_data in data.items:
        po_item = db.query(PurchaseOrderItem).filter(
            PurchaseOrderItem.id == item_data.order_item_id
        ).first()
        if not po_item:
            raise HTTPException(status_code=400, detail=f"订单明细ID {item_data.order_item_id} 不存在")
        # 检查可入库数量
        available = po_item.quantity - (po_item.received_quantity or Decimal("0"))
        if item_data.received_quantity > available:
            raise HTTPException(
                status_code=400,
                detail=f"明细ID {item_data.order_item_id} 入库数量超出可入库数量",
            )
        amount = (item_data.received_quantity * po_item.unit_price).quantize(Decimal("0.01"))
        receipt_item = PurchaseReceiptItem(
            receipt_id=receipt.id,
            material_id=po_item.material_id,
            order_item_id=po_item.id,
            order_quantity=po_item.quantity,
            received_quantity=item_data.received_quantity,
            qualified_quantity=item_data.received_quantity,
            unit_price=po_item.unit_price,
            amount=amount,
        )
        db.add(receipt_item)
        total_quantity += item_data.received_quantity
        total_amount += amount

    receipt.total_quantity = total_quantity
    receipt.total_amount = total_amount
    db.commit()
    db.refresh(receipt)
    return {
        "detail": "下推成功",
        "receipt_id": receipt.id,
        "receipt_no": receipt.bill_no,
    }

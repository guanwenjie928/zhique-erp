"""采购入库路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel
from decimal import Decimal

from database import get_db
from models import (
    PurchaseReceipt, PurchaseReceiptItem,
    PurchaseOrder, PurchaseOrderItem,
    Supplier, Warehouse,
    Inventory, StockMovement, Payable,
)

router = APIRouter()


# ============================================================
# Pydantic Schemas
# ============================================================

class ReceiptItemBase(BaseModel):
    material_id: int
    order_item_id: Optional[int] = None
    order_quantity: Optional[Decimal] = None
    received_quantity: Decimal
    qualified_quantity: Optional[Decimal] = None
    unit_price: Optional[Decimal] = Decimal("0")
    batch_no: Optional[str] = None
    remark: Optional[str] = None


class ReceiptItemCreate(ReceiptItemBase):
    pass


class ReceiptItemOut(ReceiptItemBase):
    id: int
    receipt_id: int
    amount: Optional[Decimal] = Decimal("0")

    class Config:
        from_attributes = True


class ReceiptBase(BaseModel):
    bill_date: date
    supplier_id: int
    order_id: Optional[int] = None
    order_no: Optional[str] = None
    warehouse_id: int
    receiver_id: Optional[int] = None
    inspect_status: Optional[str] = "pending"
    remark: Optional[str] = None


class ReceiptCreate(ReceiptBase):
    items: List[ReceiptItemCreate]


class ReceiptUpdate(BaseModel):
    bill_date: Optional[date] = None
    supplier_id: Optional[int] = None
    order_id: Optional[int] = None
    order_no: Optional[str] = None
    warehouse_id: Optional[int] = None
    receiver_id: Optional[int] = None
    inspect_status: Optional[str] = None
    status: Optional[str] = None
    remark: Optional[str] = None
    items: Optional[List[ReceiptItemCreate]] = None


class ReceiptOut(ReceiptBase):
    id: int
    bill_no: str
    total_quantity: Optional[Decimal] = Decimal("0")
    total_amount: Optional[Decimal] = Decimal("0")
    status: str
    source_bill_type: Optional[str] = None
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
    prefix = f"PI-{today_str}-"
    count = db.query(PurchaseReceipt).filter(
        PurchaseReceipt.bill_no.like(f"{prefix}%")
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
    supplier_id: Optional[int] = Query(None),
    warehouse_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """采购入库单列表"""
    query = db.query(PurchaseReceipt)
    if search:
        query = query.filter(
            or_(
                PurchaseReceipt.bill_no.contains(search),
                PurchaseReceipt.order_no.contains(search),
            )
        )
    if status:
        query = query.filter(PurchaseReceipt.status == status)
    if supplier_id:
        query = query.filter(PurchaseReceipt.supplier_id == supplier_id)
    if warehouse_id:
        query = query.filter(PurchaseReceipt.warehouse_id == warehouse_id)
    query = query.order_by(PurchaseReceipt.id.desc())
    return query.offset(skip).limit(limit).all()


@router.get("/{receipt_id}", response_model=ReceiptOut)
def get_receipt(receipt_id: int, db: Session = Depends(get_db)):
    """获取入库单详情"""
    receipt = db.query(PurchaseReceipt).filter(PurchaseReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="入库单不存在")
    return receipt


@router.post("/", response_model=ReceiptOut)
def create_receipt(data: ReceiptCreate, db: Session = Depends(get_db)):
    """新增采购入库单"""
    if not data.items:
        raise HTTPException(status_code=400, detail="至少需要一条明细")
    bill_no = _generate_bill_no(db)
    receipt = PurchaseReceipt(
        bill_no=bill_no,
        bill_date=data.bill_date,
        supplier_id=data.supplier_id,
        order_id=data.order_id,
        order_no=data.order_no,
        warehouse_id=data.warehouse_id,
        receiver_id=data.receiver_id,
        inspect_status=data.inspect_status,
        status="draft",
        remark=data.remark,
    )
    db.add(receipt)
    db.flush()

    total_quantity = Decimal("0")
    total_amount = Decimal("0")
    for item_data in data.items:
        qty = item_data.received_quantity
        price = item_data.unit_price or Decimal("0")
        amount = (qty * price).quantize(Decimal("0.01"))
        item = PurchaseReceiptItem(
            receipt_id=receipt.id,
            material_id=item_data.material_id,
            order_item_id=item_data.order_item_id,
            order_quantity=item_data.order_quantity,
            received_quantity=qty,
            qualified_quantity=item_data.qualified_quantity or qty,
            unit_price=price,
            amount=amount,
            batch_no=item_data.batch_no,
            remark=item_data.remark,
        )
        db.add(item)
        total_quantity += qty
        total_amount += amount

    receipt.total_quantity = total_quantity
    receipt.total_amount = total_amount
    db.commit()
    db.refresh(receipt)
    return receipt


@router.put("/{receipt_id}", response_model=ReceiptOut)
def update_receipt(receipt_id: int, data: ReceiptUpdate, db: Session = Depends(get_db)):
    """修改入库单"""
    receipt = db.query(PurchaseReceipt).filter(PurchaseReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="入库单不存在")
    if receipt.status not in ("draft", "submitted"):
        raise HTTPException(status_code=400, detail="已审核的单据不能修改")
    update_data = data.model_dump(exclude_unset=True)
    items_data = update_data.pop("items", None)
    for key, value in update_data.items():
        setattr(receipt, key, value)
    if items_data is not None:
        db.query(PurchaseReceiptItem).filter(
            PurchaseReceiptItem.receipt_id == receipt.id
        ).delete()
        total_quantity = Decimal("0")
        total_amount = Decimal("0")
        for item_data in items_data:
            item_obj = ReceiptItemCreate(**item_data)
            qty = item_obj.received_quantity
            price = item_obj.unit_price or Decimal("0")
            amount = (qty * price).quantize(Decimal("0.01"))
            item = PurchaseReceiptItem(
                receipt_id=receipt.id,
                material_id=item_obj.material_id,
                order_item_id=item_obj.order_item_id,
                order_quantity=item_obj.order_quantity,
                received_quantity=qty,
                qualified_quantity=item_obj.qualified_quantity or qty,
                unit_price=price,
                amount=amount,
                batch_no=item_obj.batch_no,
                remark=item_obj.remark,
            )
            db.add(item)
            total_quantity += qty
            total_amount += amount
        receipt.total_quantity = total_quantity
        receipt.total_amount = total_amount
    db.commit()
    db.refresh(receipt)
    return receipt


@router.delete("/{receipt_id}")
def delete_receipt(receipt_id: int, db: Session = Depends(get_db)):
    """删除入库单"""
    receipt = db.query(PurchaseReceipt).filter(PurchaseReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="入库单不存在")
    if receipt.status not in ("draft",):
        raise HTTPException(status_code=400, detail="非草稿状态不能删除")
    db.delete(receipt)
    db.commit()
    return {"detail": "删除成功"}


@router.post("/{receipt_id}/audit", response_model=ReceiptOut)
def audit_receipt(receipt_id: int, data: AuditRequest, db: Session = Depends(get_db)):
    """审核采购入库单 - 核心业务逻辑

    审核时执行以下操作:
    1. 创建库存流水记录 (StockMovement)
    2. 更新库存数量 (Inventory) - 移动平均成本
    3. 创建应付账款 (Payable)
    4. 更新采购订单明细已入库数量 (PurchaseOrderItem.received_quantity)
    5. 更新采购订单状态 (全部入库 => receipted, 部分入库 => partial_receipt)
    """
    receipt = db.query(PurchaseReceipt).filter(PurchaseReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="入库单不存在")
    if receipt.status not in ("draft", "submitted"):
        raise HTTPException(status_code=400, detail="当前状态不能审核")

    # 遍历明细执行业务逻辑
    for item in receipt.items:
        qty = item.received_quantity
        unit_cost = item.unit_price or Decimal("0")

        # 1. 查找或创建库存记录
        inv = db.query(Inventory).filter(
            Inventory.material_id == item.material_id,
            Inventory.warehouse_id == receipt.warehouse_id,
        ).first()

        if inv:
            # 移动平均成本 = (原库存数量 * 原平均成本 + 入库数量 * 入库单价) / (原库存数量 + 入库数量)
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
                warehouse_id=receipt.warehouse_id,
                quantity=qty,
                locked_quantity=Decimal("0"),
                average_cost=unit_cost,
                last_in_date=datetime.now(),
            )
            db.add(inv)

        # 2. 创建库存流水
        movement = StockMovement(
            material_id=item.material_id,
            warehouse_id=receipt.warehouse_id,
            movement_type="in",
            source_type="purchase_receipt",
            source_bill_no=receipt.bill_no,
            quantity=qty,
            unit_cost=unit_cost,
            balance_quantity=inv.quantity,
            movement_date=datetime.now(),
            remark=f"采购入库-{receipt.bill_no}",
        )
        db.add(movement)

        # 3. 更新采购订单明细已入库数量
        if item.order_item_id:
            po_item = db.query(PurchaseOrderItem).filter(
                PurchaseOrderItem.id == item.order_item_id
            ).first()
            if po_item:
                po_item.received_quantity = (po_item.received_quantity or Decimal("0")) + qty

    # 4. 更新采购订单状态
    if receipt.order_id:
        po = db.query(PurchaseOrder).filter(PurchaseOrder.id == receipt.order_id).first()
        if po:
            all_received = True
            any_received = False
            for po_item in po.items:
                if (po_item.received_quantity or Decimal("0")) >= po_item.quantity:
                    any_received = True
                elif (po_item.received_quantity or Decimal("0")) > 0:
                    any_received = True
                    all_received = False
                else:
                    all_received = False
            if all_received:
                po.status = "receipted"
            elif any_received:
                po.status = "partial_receipt"

    # 5. 创建应付账款
    payable = Payable(
        supplier_id=receipt.supplier_id,
        bill_type="purchase_receipt",
        bill_no=receipt.bill_no,
        bill_date=receipt.bill_date,
        amount=receipt.total_amount or Decimal("0"),
        paid_amount=Decimal("0"),
        balance=receipt.total_amount or Decimal("0"),
        status="unpaid",
        remark=f"采购入库-{receipt.bill_no}",
    )
    db.add(payable)

    # 6. 更新入库单状态
    receipt.status = "audited"
    receipt.audited_by = data.audited_by
    receipt.audited_at = datetime.now()

    db.commit()
    db.refresh(receipt)
    return receipt

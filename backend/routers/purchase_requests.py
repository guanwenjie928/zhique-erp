"""采购申请路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel
from decimal import Decimal
import json

from database import get_db
from models import (
    PurchaseRequest, PurchaseRequestItem,
    PurchaseOrder, PurchaseOrderItem,
    Material,
)

router = APIRouter()


# ============================================================
# Pydantic Schemas
# ============================================================

class PRItemBase(BaseModel):
    material_id: int
    quantity: Decimal
    remark: Optional[str] = None


class PRItemCreate(PRItemBase):
    pass


class PRItemOut(PRItemBase):
    id: int
    request_id: int
    linked_quantity: Optional[Decimal] = Decimal("0")

    class Config:
        from_attributes = True


class PRBase(BaseModel):
    bill_date: date
    department_id: Optional[int] = None
    requester_id: Optional[int] = None
    expected_date: Optional[date] = None
    reason: Optional[str] = None
    remark: Optional[str] = None


class PRCreate(PRBase):
    items: List[PRItemCreate]


class PRUpdate(BaseModel):
    bill_date: Optional[date] = None
    department_id: Optional[int] = None
    requester_id: Optional[int] = None
    expected_date: Optional[date] = None
    reason: Optional[str] = None
    status: Optional[str] = None
    remark: Optional[str] = None
    items: Optional[List[PRItemCreate]] = None


class PROut(PRBase):
    id: int
    bill_no: str
    status: str
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    audited_by: Optional[int] = None
    audited_at: Optional[datetime] = None
    items: List[PRItemOut] = []

    class Config:
        from_attributes = True


class AuditRequest(BaseModel):
    audited_by: int


class PushDownItem(BaseModel):
    request_item_id: int
    quantity: Decimal


class PushDownRequest(BaseModel):
    supplier_id: int
    bill_date: date
    buyer_id: Optional[int] = None
    department_id: Optional[int] = None
    expected_date: Optional[date] = None
    items: List[PushDownItem]
    remark: Optional[str] = None


# ============================================================
# Helper: Bill number generation
# ============================================================

def _generate_bill_no(db: Session, prefix: str = "PR") -> str:
    """生成单据编号: PR-YYYYMMDD-001"""
    today_str = date.today().strftime("%Y%m%d")
    prefix_full = f"{prefix}-{today_str}-"
    count = db.query(PurchaseRequest).filter(
        PurchaseRequest.bill_no.like(f"{prefix_full}%")
    ).count()
    return f"{prefix_full}{count + 1:03d}"


# ============================================================
# Endpoints
# ============================================================

@router.get("/", response_model=List[PROut])
def list_purchase_requests(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    department_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """采购申请列表"""
    query = db.query(PurchaseRequest)
    if search:
        query = query.filter(
            or_(
                PurchaseRequest.bill_no.contains(search),
                PurchaseRequest.reason.contains(search),
            )
        )
    if status:
        query = query.filter(PurchaseRequest.status == status)
    if department_id:
        query = query.filter(PurchaseRequest.department_id == department_id)
    query = query.order_by(PurchaseRequest.id.desc())
    return query.offset(skip).limit(limit).all()


@router.get("/{pr_id}", response_model=PROut)
def get_purchase_request(pr_id: int, db: Session = Depends(get_db)):
    """获取采购申请详情"""
    pr = db.query(PurchaseRequest).filter(PurchaseRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="采购申请单不存在")
    return pr


@router.post("/", response_model=PROut)
def create_purchase_request(data: PRCreate, db: Session = Depends(get_db)):
    """新增采购申请"""
    if not data.items:
        raise HTTPException(status_code=400, detail="至少需要一条明细")
    bill_no = _generate_bill_no(db)
    pr = PurchaseRequest(
        bill_no=bill_no,
        bill_date=data.bill_date,
        department_id=data.department_id,
        requester_id=data.requester_id,
        expected_date=data.expected_date,
        reason=data.reason,
        remark=data.remark,
        status="draft",
    )
    db.add(pr)
    db.flush()
    for item_data in data.items:
        item = PurchaseRequestItem(
            request_id=pr.id,
            material_id=item_data.material_id,
            quantity=item_data.quantity,
            remark=item_data.remark,
        )
        db.add(item)
    db.commit()
    db.refresh(pr)
    return pr


@router.put("/{pr_id}", response_model=PROut)
def update_purchase_request(pr_id: int, data: PRUpdate, db: Session = Depends(get_db)):
    """修改采购申请"""
    pr = db.query(PurchaseRequest).filter(PurchaseRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="采购申请单不存在")
    if pr.status not in ("draft", "submitted"):
        raise HTTPException(status_code=400, detail="已审核的单据不能修改")
    update_data = data.model_dump(exclude_unset=True)
    items_data = update_data.pop("items", None)
    for key, value in update_data.items():
        setattr(pr, key, value)
    if items_data is not None:
        # 删除旧明细，创建新明细
        db.query(PurchaseRequestItem).filter(
            PurchaseRequestItem.request_id == pr.id
        ).delete()
        for item_data in items_data:
            item = PurchaseRequestItem(
                request_id=pr.id,
                material_id=item_data["material_id"],
                quantity=item_data["quantity"],
                remark=item_data.get("remark"),
            )
            db.add(item)
    db.commit()
    db.refresh(pr)
    return pr


@router.delete("/{pr_id}")
def delete_purchase_request(pr_id: int, db: Session = Depends(get_db)):
    """删除采购申请"""
    pr = db.query(PurchaseRequest).filter(PurchaseRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="采购申请单不存在")
    if pr.status not in ("draft",):
        raise HTTPException(status_code=400, detail="非草稿状态不能删除")
    db.delete(pr)
    db.commit()
    return {"detail": "删除成功"}


@router.post("/{pr_id}/audit", response_model=PROut)
def audit_purchase_request(pr_id: int, data: AuditRequest, db: Session = Depends(get_db)):
    """审核采购申请"""
    pr = db.query(PurchaseRequest).filter(PurchaseRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="采购申请单不存在")
    if pr.status not in ("draft", "submitted"):
        raise HTTPException(status_code=400, detail="当前状态不能审核")
    pr.status = "audited"
    pr.audited_by = data.audited_by
    pr.audited_at = datetime.now()
    db.commit()
    db.refresh(pr)
    return pr


@router.post("/{pr_id}/push-down", response_model=dict)
def push_down_to_purchase_order(
    pr_id: int,
    data: PushDownRequest,
    db: Session = Depends(get_db),
):
    """采购申请下推生成采购订单"""
    pr = db.query(PurchaseRequest).filter(PurchaseRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="采购申请单不存在")
    if pr.status != "audited":
        raise HTTPException(status_code=400, detail="只有已审核的申请单才能下推")

    # 生成采购订单编号
    today_str = date.today().strftime("%Y%m%d")
    po_prefix = f"PO-{today_str}-"
    po_count = db.query(PurchaseOrder).filter(
        PurchaseOrder.bill_no.like(f"{po_prefix}%")
    ).count()
    po_bill_no = f"{po_prefix}{po_count + 1:03d}"

    # 计算订单总金额
    total_amount = Decimal("0")
    total_tax = Decimal("0")
    total_with_tax = Decimal("0")

    po = PurchaseOrder(
        bill_no=po_bill_no,
        bill_date=data.bill_date,
        supplier_id=data.supplier_id,
        department_id=data.department_id or pr.department_id,
        buyer_id=data.buyer_id,
        status="draft",
        source_bill_type="purchase_request",
        source_bill_no=pr.bill_no,
        expected_date=data.expected_date,
        remark=data.remark,
    )
    db.add(po)
    db.flush()

    for item_data in data.items:
        pr_item = db.query(PurchaseRequestItem).filter(
            PurchaseRequestItem.id == item_data.request_item_id
        ).first()
        if not pr_item:
            raise HTTPException(status_code=400, detail=f"申请明细ID {item_data.request_item_id} 不存在")
        # 检查可下推数量
        available = pr_item.quantity - (pr_item.linked_quantity or Decimal("0"))
        if item_data.quantity > available:
            raise HTTPException(
                status_code=400,
                detail=f"明细ID {item_data.request_item_id} 下推数量超出可下推数量",
            )
        # 获取物料信息
        material = db.query(Material).filter(Material.id == pr_item.material_id).first()
        if not material:
            raise HTTPException(status_code=400, detail="物料不存在")
        unit_price = material.standard_price or Decimal("0")
        tax_rate = material.tax_rate or Decimal("0.13")
        amount = (item_data.quantity * unit_price).quantize(Decimal("0.01"))
        tax_amount = (amount * tax_rate).quantize(Decimal("0.01"))
        total = (amount + tax_amount).quantize(Decimal("0.01"))

        po_item = PurchaseOrderItem(
            order_id=po.id,
            material_id=pr_item.material_id,
            quantity=item_data.quantity,
            unit_price=unit_price,
            tax_rate=tax_rate,
            amount=amount,
            tax_amount=tax_amount,
            total_amount=total,
            source_request_item_id=pr_item.id,
        )
        db.add(po_item)

        # 更新申请明细已转数量
        pr_item.linked_quantity = (pr_item.linked_quantity or Decimal("0")) + item_data.quantity

        total_amount += amount
        total_tax += tax_amount
        total_with_tax += total

    po.total_amount = total_amount
    po.total_tax = total_tax
    po.total_amount_with_tax = total_with_tax

    # 检查是否全部下推完成
    all_linked = True
    for item in pr.items:
        if (item.linked_quantity or Decimal("0")) < item.quantity:
            all_linked = False
            break
    if all_linked:
        pr.status = "linked"

    db.commit()
    db.refresh(po)
    return {
        "detail": "下推成功",
        "purchase_order_id": po.id,
        "purchase_order_no": po.bill_no,
    }

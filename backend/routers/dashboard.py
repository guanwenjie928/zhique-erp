"""仪表盘路由"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel
from decimal import Decimal

from database import get_db
from models import (
    PurchaseOrder, PurchaseReceipt, PurchaseReturn,
    SalesOrder, SalesDelivery, SalesReturn,
    Inventory, Material, Payable, Receivable,
    Warehouse,
)

router = APIRouter()


# ============================================================
# Pydantic Schemas
# ============================================================

class DashboardStats(BaseModel):
    total_purchase_amount: Decimal = Decimal("0")
    total_sales_amount: Decimal = Decimal("0")
    low_stock_count: int = 0
    pending_payable_count: int = 0
    pending_receivable_count: int = 0
    total_payable_balance: Decimal = Decimal("0")
    total_receivable_balance: Decimal = Decimal("0")
    total_inventory_value: Decimal = Decimal("0")


class RecentBill(BaseModel):
    bill_type: str
    bill_no: str
    bill_date: Optional[date] = None
    amount: Optional[Decimal] = None
    status: Optional[str] = None
    party_name: Optional[str] = None


# ============================================================
# Endpoints
# ============================================================

@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """获取仪表盘统计数据

    - 采购总额: 已审核的采购订单价税合计
    - 销售总额: 已审核的销售订单价税合计
    - 低库存数量: 低于安全库存的物料数
    - 待付应付数量: 未结清的应付账款数
    - 待收应收数量: 未结清的应收账款数
    - 应付余额总计
    - 应收余额总计
    - 库存总价值
    """
    # 采购总额（已审核的采购订单）
    purchase_total = db.query(func.sum(PurchaseOrder.total_amount_with_tax)).filter(
        PurchaseOrder.status.in_(["audited", "partial_receipt", "receipted", "closed"])
    ).scalar() or Decimal("0")

    # 销售总额（已审核的销售订单）
    sales_total = db.query(func.sum(SalesOrder.total_amount_with_tax)).filter(
        SalesOrder.status.in_(["audited", "partial_delivery", "delivered", "closed"])
    ).scalar() or Decimal("0")

    # 低库存数量
    all_materials = db.query(Material).all()
    low_stock_count = 0
    for material in all_materials:
        if not material.safety_stock or material.safety_stock <= 0:
            continue
        total_qty = db.query(func.sum(Inventory.quantity)).filter(
            Inventory.material_id == material.id
        ).scalar() or Decimal("0")
        if total_qty < material.safety_stock:
            low_stock_count += 1

    # 待付应付数量
    pending_payable_count = db.query(Payable).filter(
        Payable.status.in_(["unpaid", "partial"])
    ).count()

    # 待收应收数量
    pending_receivable_count = db.query(Receivable).filter(
        Receivable.status.in_(["unpaid", "partial"])
    ).count()

    # 应付余额总计
    total_payable_balance = db.query(func.sum(Payable.balance)).filter(
        Payable.status.in_(["unpaid", "partial"])
    ).scalar() or Decimal("0")

    # 应收余额总计
    total_receivable_balance = db.query(func.sum(Receivable.balance)).filter(
        Receivable.status.in_(["unpaid", "partial"])
    ).scalar() or Decimal("0")

    # 库存总价值
    total_inventory_value = db.query(
        func.sum(Inventory.quantity * Inventory.average_cost)
    ).scalar() or Decimal("0")

    return DashboardStats(
        total_purchase_amount=purchase_total,
        total_sales_amount=sales_total,
        low_stock_count=low_stock_count,
        pending_payable_count=pending_payable_count,
        pending_receivable_count=pending_receivable_count,
        total_payable_balance=total_payable_balance,
        total_receivable_balance=total_receivable_balance,
        total_inventory_value=total_inventory_value,
    )


@router.get("/recent-bills", response_model=List[RecentBill])
def get_recent_bills(
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """获取最近单据列表"""
    bills = []

    # 采购订单
    pos = db.query(PurchaseOrder).order_by(
        PurchaseOrder.id.desc()
    ).limit(limit).all()
    for po in pos:
        bills.append(RecentBill(
            bill_type="采购订单",
            bill_no=po.bill_no,
            bill_date=po.bill_date,
            amount=po.total_amount_with_tax,
            status=po.status,
            party_name=po.supplier.name if po.supplier else None,
        ))

    # 销售订单
    sos = db.query(SalesOrder).order_by(
        SalesOrder.id.desc()
    ).limit(limit).all()
    for so in sos:
        bills.append(RecentBill(
            bill_type="销售订单",
            bill_no=so.bill_no,
            bill_date=so.bill_date,
            amount=so.total_amount_with_tax,
            status=so.status,
            party_name=so.customer.name if so.customer else None,
        ))

    # 采购入库
    prs = db.query(PurchaseReceipt).order_by(
        PurchaseReceipt.id.desc()
    ).limit(limit).all()
    for pr in prs:
        bills.append(RecentBill(
            bill_type="采购入库",
            bill_no=pr.bill_no,
            bill_date=pr.bill_date,
            amount=pr.total_amount,
            status=pr.status,
            party_name=pr.supplier.name if pr.supplier else None,
        ))

    # 销售出库
    sds = db.query(SalesDelivery).order_by(
        SalesDelivery.id.desc()
    ).limit(limit).all()
    for sd in sds:
        bills.append(RecentBill(
            bill_type="销售出库",
            bill_no=sd.bill_no,
            bill_date=sd.bill_date,
            amount=sd.total_amount,
            status=sd.status,
            party_name=sd.customer.name if sd.customer else None,
        ))

    # 按日期降序排序并截取
    bills.sort(key=lambda x: x.bill_date or date.min, reverse=True)
    return bills[:limit]

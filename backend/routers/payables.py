"""应付账款路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel
from decimal import Decimal

from database import get_db
from models import Payable, Supplier

router = APIRouter()


# ============================================================
# Pydantic Schemas
# ============================================================

class PayableOut(BaseModel):
    id: int
    supplier_id: int
    bill_type: Optional[str] = None
    bill_no: Optional[str] = None
    bill_date: Optional[date] = None
    amount: Optional[Decimal] = None
    paid_amount: Optional[Decimal] = None
    balance: Optional[Decimal] = None
    status: Optional[str] = None
    due_date: Optional[date] = None
    remark: Optional[str] = None
    created_at: Optional[datetime] = None
    supplier_name: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================================
# Endpoints
# ============================================================

@router.get("/", response_model=List[PayableOut])
def list_payables(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    supplier_id: Optional[int] = Query(None),
    bill_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """应付账款列表"""
    query = db.query(Payable)
    if search:
        query = query.filter(
            or_(
                Payable.bill_no.contains(search),
                Payable.remark.contains(search),
            )
        )
    if status:
        query = query.filter(Payable.status == status)
    if supplier_id:
        query = query.filter(Payable.supplier_id == supplier_id)
    if bill_type:
        query = query.filter(Payable.bill_type == bill_type)
    query = query.order_by(Payable.id.desc())
    payables = query.offset(skip).limit(limit).all()

    result = []
    for p in payables:
        supplier = db.query(Supplier).filter(Supplier.id == p.supplier_id).first()
        result.append(PayableOut(
            id=p.id,
            supplier_id=p.supplier_id,
            bill_type=p.bill_type,
            bill_no=p.bill_no,
            bill_date=p.bill_date,
            amount=p.amount,
            paid_amount=p.paid_amount,
            balance=p.balance,
            status=p.status,
            due_date=p.due_date,
            remark=p.remark,
            created_at=p.created_at,
            supplier_name=supplier.name if supplier else None,
        ))
    return result


@router.get("/{payable_id}", response_model=PayableOut)
def get_payable(payable_id: int, db: Session = Depends(get_db)):
    """获取应付账款详情"""
    p = db.query(Payable).filter(Payable.id == payable_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="应付账款不存在")
    supplier = db.query(Supplier).filter(Supplier.id == p.supplier_id).first()
    return PayableOut(
        id=p.id,
        supplier_id=p.supplier_id,
        bill_type=p.bill_type,
        bill_no=p.bill_no,
        bill_date=p.bill_date,
        amount=p.amount,
        paid_amount=p.paid_amount,
        balance=p.balance,
        status=p.status,
        due_date=p.due_date,
        remark=p.remark,
        created_at=p.created_at,
        supplier_name=supplier.name if supplier else None,
    )

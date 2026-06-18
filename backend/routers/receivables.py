"""应收账款路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel
from decimal import Decimal

from database import get_db
from models import Receivable, Customer

router = APIRouter()


# ============================================================
# Pydantic Schemas
# ============================================================

class ReceivableOut(BaseModel):
    id: int
    customer_id: int
    bill_type: Optional[str] = None
    bill_no: Optional[str] = None
    bill_date: Optional[date] = None
    amount: Optional[Decimal] = None
    received_amount: Optional[Decimal] = None
    balance: Optional[Decimal] = None
    status: Optional[str] = None
    due_date: Optional[date] = None
    remark: Optional[str] = None
    created_at: Optional[datetime] = None
    customer_name: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================================
# Endpoints
# ============================================================

@router.get("/", response_model=List[ReceivableOut])
def list_receivables(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    bill_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """应收账款列表"""
    query = db.query(Receivable)
    if search:
        query = query.filter(
            or_(
                Receivable.bill_no.contains(search),
                Receivable.remark.contains(search),
            )
        )
    if status:
        query = query.filter(Receivable.status == status)
    if customer_id:
        query = query.filter(Receivable.customer_id == customer_id)
    if bill_type:
        query = query.filter(Receivable.bill_type == bill_type)
    query = query.order_by(Receivable.id.desc())
    receivables = query.offset(skip).limit(limit).all()

    result = []
    for r in receivables:
        customer = db.query(Customer).filter(Customer.id == r.customer_id).first()
        result.append(ReceivableOut(
            id=r.id,
            customer_id=r.customer_id,
            bill_type=r.bill_type,
            bill_no=r.bill_no,
            bill_date=r.bill_date,
            amount=r.amount,
            received_amount=r.received_amount,
            balance=r.balance,
            status=r.status,
            due_date=r.due_date,
            remark=r.remark,
            created_at=r.created_at,
            customer_name=customer.name if customer else None,
        ))
    return result


@router.get("/{receivable_id}", response_model=ReceivableOut)
def get_receivable(receivable_id: int, db: Session = Depends(get_db)):
    """获取应收账款详情"""
    r = db.query(Receivable).filter(Receivable.id == receivable_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="应收账款不存在")
    customer = db.query(Customer).filter(Customer.id == r.customer_id).first()
    return ReceivableOut(
        id=r.id,
        customer_id=r.customer_id,
        bill_type=r.bill_type,
        bill_no=r.bill_no,
        bill_date=r.bill_date,
        amount=r.amount,
        received_amount=r.received_amount,
        balance=r.balance,
        status=r.status,
        due_date=r.due_date,
        remark=r.remark,
        created_at=r.created_at,
        customer_name=customer.name if customer else None,
    )

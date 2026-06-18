"""客户档案路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from decimal import Decimal

from database import get_db
from models import Customer

router = APIRouter()


# ============================================================
# Pydantic Schemas
# ============================================================

class CustomerBase(BaseModel):
    code: str
    name: str
    short_name: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    tax_number: Optional[str] = None
    credit_limit: Optional[Decimal] = Decimal("0")
    payment_terms: Optional[str] = "月结30天"
    status: Optional[str] = "active"
    remark: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    short_name: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    tax_number: Optional[str] = None
    credit_limit: Optional[Decimal] = None
    payment_terms: Optional[str] = None
    status: Optional[str] = None
    remark: Optional[str] = None


class CustomerOut(CustomerBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================
# Endpoints
# ============================================================

@router.get("/", response_model=List[CustomerOut])
def list_customers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """客户列表"""
    query = db.query(Customer)
    if search:
        query = query.filter(
            or_(
                Customer.code.contains(search),
                Customer.name.contains(search),
                Customer.short_name.contains(search),
                Customer.contact_person.contains(search),
            )
        )
    if status:
        query = query.filter(Customer.status == status)
    query = query.order_by(Customer.id.desc())
    return query.offset(skip).limit(limit).all()


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    """获取客户详情"""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")
    return customer


@router.post("/", response_model=CustomerOut)
def create_customer(data: CustomerCreate, db: Session = Depends(get_db)):
    """新增客户"""
    exists = db.query(Customer).filter(Customer.code == data.code).first()
    if exists:
        raise HTTPException(status_code=400, detail="客户编码已存在")
    customer = Customer(**data.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: int, data: CustomerUpdate, db: Session = Depends(get_db)):
    """修改客户"""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")
    update_data = data.model_dump(exclude_unset=True)
    if "code" in update_data and update_data["code"] != customer.code:
        exists = db.query(Customer).filter(Customer.code == update_data["code"]).first()
        if exists:
            raise HTTPException(status_code=400, detail="客户编码已存在")
    for key, value in update_data.items():
        setattr(customer, key, value)
    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    """删除客户"""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")
    db.delete(customer)
    db.commit()
    return {"detail": "删除成功"}

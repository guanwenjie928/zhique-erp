"""供应商档案路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from decimal import Decimal

from database import get_db
from models import Supplier

router = APIRouter()


# ============================================================
# Pydantic Schemas
# ============================================================

class SupplierBase(BaseModel):
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
    payment_terms: Optional[str] = "月结30天"
    rating: Optional[str] = "B"
    status: Optional[str] = "active"
    remark: Optional[str] = None


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
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
    payment_terms: Optional[str] = None
    rating: Optional[str] = None
    status: Optional[str] = None
    remark: Optional[str] = None


class SupplierOut(SupplierBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================
# Endpoints
# ============================================================

@router.get("/", response_model=List[SupplierOut])
def list_suppliers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    rating: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """供应商列表"""
    query = db.query(Supplier)
    if search:
        query = query.filter(
            or_(
                Supplier.code.contains(search),
                Supplier.name.contains(search),
                Supplier.short_name.contains(search),
                Supplier.contact_person.contains(search),
            )
        )
    if status:
        query = query.filter(Supplier.status == status)
    if rating:
        query = query.filter(Supplier.rating == rating)
    query = query.order_by(Supplier.id.desc())
    return query.offset(skip).limit(limit).all()


@router.get("/{supplier_id}", response_model=SupplierOut)
def get_supplier(supplier_id: int, db: Session = Depends(get_db)):
    """获取供应商详情"""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="供应商不存在")
    return supplier


@router.post("/", response_model=SupplierOut)
def create_supplier(data: SupplierCreate, db: Session = Depends(get_db)):
    """新增供应商"""
    exists = db.query(Supplier).filter(Supplier.code == data.code).first()
    if exists:
        raise HTTPException(status_code=400, detail="供应商编码已存在")
    supplier = Supplier(**data.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.put("/{supplier_id}", response_model=SupplierOut)
def update_supplier(supplier_id: int, data: SupplierUpdate, db: Session = Depends(get_db)):
    """修改供应商"""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="供应商不存在")
    update_data = data.model_dump(exclude_unset=True)
    if "code" in update_data and update_data["code"] != supplier.code:
        exists = db.query(Supplier).filter(Supplier.code == update_data["code"]).first()
        if exists:
            raise HTTPException(status_code=400, detail="供应商编码已存在")
    for key, value in update_data.items():
        setattr(supplier, key, value)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.delete("/{supplier_id}")
def delete_supplier(supplier_id: int, db: Session = Depends(get_db)):
    """删除供应商"""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="供应商不存在")
    db.delete(supplier)
    db.commit()
    return {"detail": "删除成功"}

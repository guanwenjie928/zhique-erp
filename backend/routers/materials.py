"""物料档案路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from decimal import Decimal

from database import get_db
from models import Material

router = APIRouter()


# ============================================================
# Pydantic Schemas
# ============================================================

class MaterialBase(BaseModel):
    code: str
    name: str
    specification: Optional[str] = None
    unit: str
    material_type: Optional[str] = "raw"
    category_id: Optional[int] = None
    standard_price: Optional[Decimal] = Decimal("0")
    standard_cost: Optional[Decimal] = Decimal("0")
    safety_stock: Optional[Decimal] = Decimal("0")
    tax_rate: Optional[Decimal] = Decimal("0.13")
    status: Optional[str] = "active"
    remark: Optional[str] = None


class MaterialCreate(MaterialBase):
    pass


class MaterialUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    specification: Optional[str] = None
    unit: Optional[str] = None
    material_type: Optional[str] = None
    category_id: Optional[int] = None
    standard_price: Optional[Decimal] = None
    standard_cost: Optional[Decimal] = None
    safety_stock: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = None
    status: Optional[str] = None
    remark: Optional[str] = None


class MaterialOut(MaterialBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================
# Endpoints
# ============================================================

@router.get("/", response_model=List[MaterialOut])
def list_materials(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None, description="按编码/名称/规格搜索"),
    material_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """物料列表（支持分页与搜索）"""
    query = db.query(Material)
    if search:
        query = query.filter(
            or_(
                Material.code.contains(search),
                Material.name.contains(search),
                Material.specification.contains(search),
            )
        )
    if material_type:
        query = query.filter(Material.material_type == material_type)
    if status:
        query = query.filter(Material.status == status)
    query = query.order_by(Material.id.desc())
    items = query.offset(skip).limit(limit).all()
    return items


@router.get("/{material_id}", response_model=MaterialOut)
def get_material(material_id: int, db: Session = Depends(get_db)):
    """获取物料详情"""
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="物料不存在")
    return material


@router.post("/", response_model=MaterialOut)
def create_material(data: MaterialCreate, db: Session = Depends(get_db)):
    """新增物料"""
    exists = db.query(Material).filter(Material.code == data.code).first()
    if exists:
        raise HTTPException(status_code=400, detail="物料编码已存在")
    material = Material(**data.model_dump())
    db.add(material)
    db.commit()
    db.refresh(material)
    return material


@router.put("/{material_id}", response_model=MaterialOut)
def update_material(material_id: int, data: MaterialUpdate, db: Session = Depends(get_db)):
    """修改物料"""
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="物料不存在")
    update_data = data.model_dump(exclude_unset=True)
    # 检查编码唯一性
    if "code" in update_data and update_data["code"] != material.code:
        exists = db.query(Material).filter(Material.code == update_data["code"]).first()
        if exists:
            raise HTTPException(status_code=400, detail="物料编码已存在")
    for key, value in update_data.items():
        setattr(material, key, value)
    db.commit()
    db.refresh(material)
    return material


@router.delete("/{material_id}")
def delete_material(material_id: int, db: Session = Depends(get_db)):
    """删除物料"""
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="物料不存在")
    db.delete(material)
    db.commit()
    return {"detail": "删除成功"}

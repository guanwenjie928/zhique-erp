"""仓库路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

from database import get_db
from models import Warehouse

router = APIRouter()


# ============================================================
# Pydantic Schemas
# ============================================================

class WarehouseBase(BaseModel):
    code: str
    name: str
    address: Optional[str] = None
    manager_id: Optional[int] = None
    status: Optional[str] = "active"


class WarehouseCreate(WarehouseBase):
    pass


class WarehouseUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    address: Optional[str] = None
    manager_id: Optional[int] = None
    status: Optional[str] = None


class WarehouseOut(WarehouseBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================
# Endpoints
# ============================================================

@router.get("/", response_model=List[WarehouseOut])
def list_warehouses(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """仓库列表"""
    query = db.query(Warehouse)
    if search:
        query = query.filter(
            or_(
                Warehouse.code.contains(search),
                Warehouse.name.contains(search),
            )
        )
    if status:
        query = query.filter(Warehouse.status == status)
    query = query.order_by(Warehouse.id.desc())
    return query.offset(skip).limit(limit).all()


@router.get("/{warehouse_id}", response_model=WarehouseOut)
def get_warehouse(warehouse_id: int, db: Session = Depends(get_db)):
    """获取仓库详情"""
    warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="仓库不存在")
    return warehouse


@router.post("/", response_model=WarehouseOut)
def create_warehouse(data: WarehouseCreate, db: Session = Depends(get_db)):
    """新增仓库"""
    exists = db.query(Warehouse).filter(Warehouse.code == data.code).first()
    if exists:
        raise HTTPException(status_code=400, detail="仓库编码已存在")
    warehouse = Warehouse(**data.model_dump())
    db.add(warehouse)
    db.commit()
    db.refresh(warehouse)
    return warehouse


@router.put("/{warehouse_id}", response_model=WarehouseOut)
def update_warehouse(warehouse_id: int, data: WarehouseUpdate, db: Session = Depends(get_db)):
    """修改仓库"""
    warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="仓库不存在")
    update_data = data.model_dump(exclude_unset=True)
    if "code" in update_data and update_data["code"] != warehouse.code:
        exists = db.query(Warehouse).filter(Warehouse.code == update_data["code"]).first()
        if exists:
            raise HTTPException(status_code=400, detail="仓库编码已存在")
    for key, value in update_data.items():
        setattr(warehouse, key, value)
    db.commit()
    db.refresh(warehouse)
    return warehouse


@router.delete("/{warehouse_id}")
def delete_warehouse(warehouse_id: int, db: Session = Depends(get_db)):
    """删除仓库"""
    warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="仓库不存在")
    db.delete(warehouse)
    db.commit()
    return {"detail": "删除成功"}

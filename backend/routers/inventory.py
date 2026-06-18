"""库存路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from decimal import Decimal

from database import get_db
from models import Inventory, StockMovement, Material, Warehouse

router = APIRouter()


# ============================================================
# Pydantic Schemas
# ============================================================

class InventoryOut(BaseModel):
    id: int
    material_id: int
    warehouse_id: int
    quantity: Optional[Decimal] = Decimal("0")
    locked_quantity: Optional[Decimal] = Decimal("0")
    average_cost: Optional[Decimal] = Decimal("0")
    last_in_date: Optional[datetime] = None
    last_out_date: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    material_name: Optional[str] = None
    material_code: Optional[str] = None
    material_unit: Optional[str] = None
    warehouse_name: Optional[str] = None
    safety_stock: Optional[Decimal] = None

    class Config:
        from_attributes = True


class StockMovementOut(BaseModel):
    id: int
    material_id: int
    warehouse_id: int
    movement_type: str
    source_type: Optional[str] = None
    source_bill_no: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit_cost: Optional[Decimal] = None
    balance_quantity: Optional[Decimal] = None
    movement_date: Optional[datetime] = None
    remark: Optional[str] = None
    material_name: Optional[str] = None
    material_code: Optional[str] = None

    class Config:
        from_attributes = True


class LowStockAlertOut(BaseModel):
    material_id: int
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    material_unit: Optional[str] = None
    warehouse_id: Optional[int] = None
    warehouse_name: Optional[str] = None
    current_quantity: Optional[Decimal] = None
    safety_stock: Optional[Decimal] = None

    class Config:
        from_attributes = True


# ============================================================
# Endpoints
# ============================================================

@router.get("/", response_model=List[InventoryOut])
def list_inventory(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None, description="按物料编码/名称搜索"),
    warehouse_id: Optional[int] = Query(None),
    material_id: Optional[int] = Query(None),
    low_stock_only: bool = Query(False, description="仅显示低于安全库存的"),
    db: Session = Depends(get_db),
):
    """库存查询列表"""
    query = db.query(Inventory).join(
        Material, Inventory.material_id == Material.id, isouter=True
    ).join(
        Warehouse, Inventory.warehouse_id == Warehouse.id, isouter=True
    )

    if search:
        query = query.filter(
            or_(
                Material.code.contains(search),
                Material.name.contains(search),
            )
        )
    if warehouse_id:
        query = query.filter(Inventory.warehouse_id == warehouse_id)
    if material_id:
        query = query.filter(Inventory.material_id == material_id)

    query = query.order_by(Inventory.id.desc())
    items = query.offset(skip).limit(limit).all()

    result = []
    for inv in items:
        material = db.query(Material).filter(Material.id == inv.material_id).first()
        warehouse = db.query(Warehouse).filter(Warehouse.id == inv.warehouse_id).first()
        if low_stock_only:
            safety = material.safety_stock if material else Decimal("0")
            if (inv.quantity or Decimal("0")) >= safety:
                continue
        result.append(InventoryOut(
            id=inv.id,
            material_id=inv.material_id,
            warehouse_id=inv.warehouse_id,
            quantity=inv.quantity,
            locked_quantity=inv.locked_quantity,
            average_cost=inv.average_cost,
            last_in_date=inv.last_in_date,
            last_out_date=inv.last_out_date,
            updated_at=inv.updated_at,
            material_name=material.name if material else None,
            material_code=material.code if material else None,
            material_unit=material.unit if material else None,
            warehouse_name=warehouse.name if warehouse else None,
            safety_stock=material.safety_stock if material else None,
        ))
    return result


@router.get("/movements", response_model=List[StockMovementOut])
def list_stock_movements(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    material_id: Optional[int] = Query(None),
    warehouse_id: Optional[int] = Query(None),
    movement_type: Optional[str] = Query(None),
    source_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="按单据编号搜索"),
    db: Session = Depends(get_db),
):
    """库存流水列表"""
    query = db.query(StockMovement)
    if material_id:
        query = query.filter(StockMovement.material_id == material_id)
    if warehouse_id:
        query = query.filter(StockMovement.warehouse_id == warehouse_id)
    if movement_type:
        query = query.filter(StockMovement.movement_type == movement_type)
    if source_type:
        query = query.filter(StockMovement.source_type == source_type)
    if search:
        query = query.filter(StockMovement.source_bill_no.contains(search))
    query = query.order_by(StockMovement.id.desc())
    movements = query.offset(skip).limit(limit).all()

    result = []
    for m in movements:
        material = db.query(Material).filter(Material.id == m.material_id).first()
        result.append(StockMovementOut(
            id=m.id,
            material_id=m.material_id,
            warehouse_id=m.warehouse_id,
            movement_type=m.movement_type,
            source_type=m.source_type,
            source_bill_no=m.source_bill_no,
            quantity=m.quantity,
            unit_cost=m.unit_cost,
            balance_quantity=m.balance_quantity,
            movement_date=m.movement_date,
            remark=m.remark,
            material_name=material.name if material else None,
            material_code=material.code if material else None,
        ))
    return result


@router.get("/low-stock", response_model=List[LowStockAlertOut])
def low_stock_alert(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """低库存预警 - 查询所有库存低于安全库存的物料"""
    # 获取所有库存记录，关联物料获取安全库存
    all_inventory = db.query(Inventory).all()
    result = []
    for inv in all_inventory:
        material = db.query(Material).filter(Material.id == inv.material_id).first()
        if not material:
            continue
        safety_stock = material.safety_stock or Decimal("0")
        current_qty = inv.quantity or Decimal("0")
        if current_qty < safety_stock:
            warehouse = db.query(Warehouse).filter(Warehouse.id == inv.warehouse_id).first()
            result.append(LowStockAlertOut(
                material_id=inv.material_id,
                material_code=material.code,
                material_name=material.name,
                material_unit=material.unit,
                warehouse_id=inv.warehouse_id,
                warehouse_name=warehouse.name if warehouse else None,
                current_quantity=current_qty,
                safety_stock=safety_stock,
            ))
    return result[skip:skip + limit]

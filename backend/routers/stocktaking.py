"""盘点路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel
from decimal import Decimal
import json

from database import get_db
from models import Stocktaking, Inventory, StockMovement, Material, Warehouse

router = APIRouter()


# ============================================================
# Pydantic Schemas
# ============================================================

class StocktakingBase(BaseModel):
    bill_date: date
    warehouse_id: int
    remark: Optional[str] = None


class StocktakingCreate(StocktakingBase):
    pass


class StocktakingUpdate(BaseModel):
    bill_date: Optional[date] = None
    warehouse_id: Optional[int] = None
    status: Optional[str] = None
    remark: Optional[str] = None


class StocktakingOut(StocktakingBase):
    id: int
    bill_no: str
    status: str
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    audited_by: Optional[int] = None
    audited_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StocktakingDetailItem(BaseModel):
    material_id: int
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    material_unit: Optional[str] = None
    book_quantity: Optional[Decimal] = None
    actual_quantity: Optional[Decimal] = None
    diff_quantity: Optional[Decimal] = None


class AuditRequest(BaseModel):
    audited_by: int


# ============================================================
# Helper
# ============================================================

def _generate_bill_no(db: Session) -> str:
    today_str = date.today().strftime("%Y%m%d")
    prefix = f"ST-{today_str}-"
    count = db.query(Stocktaking).filter(
        Stocktaking.bill_no.like(f"{prefix}%")
    ).count()
    return f"{prefix}{count + 1:03d}"


# ============================================================
# Endpoints
# ============================================================

@router.get("/", response_model=List[StocktakingOut])
def list_stocktaking(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    warehouse_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """盘点单列表"""
    query = db.query(Stocktaking)
    if search:
        query = query.filter(Stocktaking.bill_no.contains(search))
    if status:
        query = query.filter(Stocktaking.status == status)
    if warehouse_id:
        query = query.filter(Stocktaking.warehouse_id == warehouse_id)
    query = query.order_by(Stocktaking.id.desc())
    return query.offset(skip).limit(limit).all()


@router.get("/{st_id}", response_model=StocktakingOut)
def get_stocktaking(st_id: int, db: Session = Depends(get_db)):
    """获取盘点单详情"""
    st = db.query(Stocktaking).filter(Stocktaking.id == st_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="盘点单不存在")
    return st


@router.get("/{st_id}/details", response_model=List[StocktakingDetailItem])
def get_stocktaking_details(st_id: int, db: Session = Depends(get_db)):
    """获取盘点单明细（账面库存列表）"""
    st = db.query(Stocktaking).filter(Stocktaking.id == st_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="盘点单不存在")
    # 查询该仓库所有库存
    inventories = db.query(Inventory).filter(
        Inventory.warehouse_id == st.warehouse_id
    ).all()
    result = []
    for inv in inventories:
        material = db.query(Material).filter(Material.id == inv.material_id).first()
        result.append(StocktakingDetailItem(
            material_id=inv.material_id,
            material_code=material.code if material else None,
            material_name=material.name if material else None,
            material_unit=material.unit if material else None,
            book_quantity=inv.quantity,
            actual_quantity=None,
            diff_quantity=None,
        ))
    return result


@router.post("/", response_model=StocktakingOut)
def create_stocktaking(data: StocktakingCreate, db: Session = Depends(get_db)):
    """新增盘点单"""
    bill_no = _generate_bill_no(db)
    st = Stocktaking(
        bill_no=bill_no,
        bill_date=data.bill_date,
        warehouse_id=data.warehouse_id,
        status="draft",
        remark=data.remark,
    )
    db.add(st)
    db.commit()
    db.refresh(st)
    return st


@router.put("/{st_id}", response_model=StocktakingOut)
def update_stocktaking(st_id: int, data: StocktakingUpdate, db: Session = Depends(get_db)):
    """修改盘点单"""
    st = db.query(Stocktaking).filter(Stocktaking.id == st_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="盘点单不存在")
    if st.status not in ("draft", "submitted"):
        raise HTTPException(status_code=400, detail="已审核的单据不能修改")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(st, key, value)
    db.commit()
    db.refresh(st)
    return st


@router.delete("/{st_id}")
def delete_stocktaking(st_id: int, db: Session = Depends(get_db)):
    """删除盘点单"""
    st = db.query(Stocktaking).filter(Stocktaking.id == st_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="盘点单不存在")
    if st.status not in ("draft",):
        raise HTTPException(status_code=400, detail="非草稿状态不能删除")
    db.delete(st)
    db.commit()
    return {"detail": "删除成功"}


@router.post("/{st_id}/audit", response_model=StocktakingOut)
def audit_stocktaking(
    st_id: int,
    data: AuditRequest,
    adjustments: Optional[List[StocktakingDetailItem]] = None,
    db: Session = Depends(get_db),
):
    """审核盘点单

    审核时执行:
    1. 根据调整明细更新库存 (Inventory)
    2. 创建库存调整流水 (StockMovement)
    """
    st = db.query(Stocktaking).filter(Stocktaking.id == st_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="盘点单不存在")
    if st.status not in ("draft", "submitted"):
        raise HTTPException(status_code=400, detail="当前状态不能审核")

    # 如果有调整明细，执行库存调整
    if adjustments:
        for adj in adjustments:
            inv = db.query(Inventory).filter(
                Inventory.material_id == adj.material_id,
                Inventory.warehouse_id == st.warehouse_id,
            ).first()
            if not inv:
                continue

            book_qty = inv.quantity or Decimal("0")
            actual_qty = adj.actual_quantity
            if actual_qty is None:
                continue
            diff = actual_qty - book_qty
            if diff == 0:
                continue

            # 更新库存
            inv.quantity = actual_qty

            # 创建调整流水
            movement = StockMovement(
                material_id=adj.material_id,
                warehouse_id=st.warehouse_id,
                movement_type="in" if diff > 0 else "out",
                source_type="stocktaking",
                source_bill_no=st.bill_no,
                quantity=diff,
                unit_cost=inv.average_cost or Decimal("0"),
                balance_quantity=actual_qty,
                movement_date=datetime.now(),
                remark=f"盘点调整-{st.bill_no}",
            )
            db.add(movement)

    st.status = "audited"
    st.audited_by = data.audited_by
    st.audited_at = datetime.now()
    db.commit()
    db.refresh(st)
    return st

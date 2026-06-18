"""部门路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

from database import get_db
from models import Department

router = APIRouter()


# ============================================================
# Pydantic Schemas
# ============================================================

class DepartmentBase(BaseModel):
    name: str
    code: str


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None


class DepartmentOut(DepartmentBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================
# Endpoints
# ============================================================

@router.get("/", response_model=List[DepartmentOut])
def list_departments(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """部门列表"""
    query = db.query(Department)
    if search:
        query = query.filter(
            or_(
                Department.name.contains(search),
                Department.code.contains(search),
            )
        )
    query = query.order_by(Department.id.desc())
    return query.offset(skip).limit(limit).all()


@router.get("/{department_id}", response_model=DepartmentOut)
def get_department(department_id: int, db: Session = Depends(get_db)):
    """获取部门详情"""
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="部门不存在")
    return dept


@router.post("/", response_model=DepartmentOut)
def create_department(data: DepartmentCreate, db: Session = Depends(get_db)):
    """新增部门"""
    exists = db.query(Department).filter(Department.code == data.code).first()
    if exists:
        raise HTTPException(status_code=400, detail="部门编码已存在")
    dept = Department(**data.model_dump())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


@router.put("/{department_id}", response_model=DepartmentOut)
def update_department(department_id: int, data: DepartmentUpdate, db: Session = Depends(get_db)):
    """修改部门"""
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="部门不存在")
    update_data = data.model_dump(exclude_unset=True)
    if "code" in update_data and update_data["code"] != dept.code:
        exists = db.query(Department).filter(Department.code == update_data["code"]).first()
        if exists:
            raise HTTPException(status_code=400, detail="部门编码已存在")
    for key, value in update_data.items():
        setattr(dept, key, value)
    db.commit()
    db.refresh(dept)
    return dept


@router.delete("/{department_id}")
def delete_department(department_id: int, db: Session = Depends(get_db)):
    """删除部门"""
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="部门不存在")
    db.delete(dept)
    db.commit()
    return {"detail": "删除成功"}

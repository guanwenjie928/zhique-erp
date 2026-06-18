"""用户路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

from database import get_db
from models import User, Department

router = APIRouter()


# ============================================================
# Pydantic Schemas
# ============================================================

class UserBase(BaseModel):
    username: str
    real_name: str
    role: Optional[str] = "buyer"
    department_id: Optional[int] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = True


class UserCreate(UserBase):
    password: Optional[str] = "123456"


class UserUpdate(BaseModel):
    username: Optional[str] = None
    real_name: Optional[str] = None
    role: Optional[str] = None
    department_id: Optional[int] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserOut(UserBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    code: int
    message: str
    data: Optional[dict] = None


# ============================================================
# Endpoints
# ============================================================

@router.get("/", response_model=List[UserOut])
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
):
    """用户列表"""
    query = db.query(User)
    if search:
        query = query.filter(
            or_(
                User.username.contains(search),
                User.real_name.contains(search),
                User.phone.contains(search),
            )
        )
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    query = query.order_by(User.id.desc())
    return query.offset(skip).limit(limit).all()


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    """获取用户详情"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@router.post("/", response_model=UserOut)
def create_user(data: UserCreate, db: Session = Depends(get_db)):
    """新增用户"""
    exists = db.query(User).filter(User.username == data.username).first()
    if exists:
        raise HTTPException(status_code=400, detail="用户名已存在")
    user = User(**data.model_dump())
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db)):
    """修改用户"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    update_data = data.model_dump(exclude_unset=True)
    if "username" in update_data and update_data["username"] != user.username:
        exists = db.query(User).filter(User.username == update_data["username"]).first()
        if exists:
            raise HTTPException(status_code=400, detail="用户名已存在")
    for key, value in update_data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    """删除用户"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    db.delete(user)
    db.commit()
    return {"detail": "删除成功"}


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """用户登录"""
    user = db.query(User).filter(User.username == data.username).first()
    if not user:
        return LoginResponse(code=404, message="用户不存在")
    if not user.is_active:
        return LoginResponse(code=403, message="账号已禁用")
    if user.password != data.password:
        return LoginResponse(code=401, message="密码错误")
    # 获取部门名称
    dept_name = None
    if user.department_id:
        dept = db.query(Department).filter(Department.id == user.department_id).first()
        if dept:
            dept_name = dept.name
    return LoginResponse(
        code=0,
        message="登录成功",
        data={
            "id": user.id,
            "username": user.username,
            "real_name": user.real_name,
            "role": user.role,
            "department_id": user.department_id,
            "department_name": dept_name,
            "phone": user.phone,
            "email": user.email,
        },
    )

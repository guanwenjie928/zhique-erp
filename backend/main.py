"""知雀ERP - FastAPI 主入口"""
import os
import sys

# 确保 backend 目录在 Python 路径中
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from database import Base, engine, get_db
from models import *  # noqa: F401,F403 - 注册所有模型
from routers import (
    materials, suppliers, customers, warehouses, departments, users,
    purchase_requests, purchase_orders, purchase_receipts, purchase_returns,
    sales_orders, sales_deliveries, sales_returns,
    inventory, stocktaking,
    payables, receivables, payments, receipts,
    dashboard, learning
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时创建表"""
    Base.metadata.create_all(bind=engine)
    print("✅ 数据库表已创建")
    yield


app = FastAPI(
    title="知雀进销存ERP训练系统",
    version="1.0.0",
    description="类金蝶风格的进销存ERP系统，内置学习模式",
    lifespan=lifespan,
)

# CORS 配置（允许前端跨域访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["仪表盘"])
app.include_router(users.router, prefix="/api/users", tags=["用户"])
app.include_router(departments.router, prefix="/api/departments", tags=["部门"])
app.include_router(materials.router, prefix="/api/materials", tags=["物料"])
app.include_router(suppliers.router, prefix="/api/suppliers", tags=["供应商"])
app.include_router(customers.router, prefix="/api/customers", tags=["客户"])
app.include_router(warehouses.router, prefix="/api/warehouses", tags=["仓库"])
app.include_router(purchase_requests.router, prefix="/api/purchase-requests", tags=["采购申请"])
app.include_router(purchase_orders.router, prefix="/api/purchase-orders", tags=["采购订单"])
app.include_router(purchase_receipts.router, prefix="/api/purchase-receipts", tags=["采购入库"])
app.include_router(purchase_returns.router, prefix="/api/purchase-returns", tags=["采购退货"])
app.include_router(sales_orders.router, prefix="/api/sales-orders", tags=["销售订单"])
app.include_router(sales_deliveries.router, prefix="/api/sales-deliveries", tags=["销售出库"])
app.include_router(sales_returns.router, prefix="/api/sales-returns", tags=["销售退货"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["库存"])
app.include_router(stocktaking.router, prefix="/api/stocktaking", tags=["盘点"])
app.include_router(payables.router, prefix="/api/payables", tags=["应付账款"])
app.include_router(receivables.router, prefix="/api/receivables", tags=["应收账款"])
app.include_router(payments.router, prefix="/api/payments", tags=["付款单"])
app.include_router(receipts.router, prefix="/api/receipts", tags=["收款单"])
app.include_router(learning.router, prefix="/api/learning", tags=["学习模式"])


@app.get("/")
async def root():
    return {"name": "知雀进销存ERP训练系统", "version": "1.0.0", "status": "running"}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

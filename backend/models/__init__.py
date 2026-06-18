"""知雀ERP - 数据模型定义（全部35张表）"""
from sqlalchemy import (
    Column, Integer, String, Text, Numeric, Date, DateTime, Boolean,
    ForeignKey, Enum as SAEnum, func
)
from sqlalchemy.orm import relationship
from database import Base


# ============================================================
# 基础数据（8张）
# ============================================================

class Department(Base):
    """部门"""
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(64), nullable=False, comment="部门名称")
    code = Column(String(32), unique=True, nullable=False, comment="部门编码")
    created_at = Column(DateTime, default=func.now())


class User(Base):
    """用户"""
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=False, comment="用户名")
    password = Column(String(128), default="123456", comment="密码")
    real_name = Column(String(64), nullable=False, comment="真实姓名")
    role = Column(String(32), default="buyer", comment="角色: admin/buyer/warehouse/finance")
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    phone = Column(String(32))
    email = Column(String(128))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())

    department = relationship("Department")


class MaterialCategory(Base):
    """物料分类"""
    __tablename__ = "material_categories"
    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(32), unique=True, nullable=False, comment="分类编码")
    name = Column(String(64), nullable=False, comment="分类名称")
    parent_id = Column(Integer, ForeignKey("material_categories.id"), nullable=True)
    sort_order = Column(Integer, default=0)

    children = relationship("MaterialCategory", remote_side=[id])


class Material(Base):
    """物料档案"""
    __tablename__ = "materials"
    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(32), unique=True, nullable=False, comment="物料编码")
    name = Column(String(128), nullable=False, comment="物料名称")
    specification = Column(String(256), comment="规格型号")
    unit = Column(String(32), nullable=False, comment="单位")
    material_type = Column(String(16), default="raw", comment="类型: raw/semi/finished")
    category_id = Column(Integer, ForeignKey("material_categories.id"), nullable=True)
    standard_price = Column(Numeric(18, 4), default=0, comment="标准采购单价")
    standard_cost = Column(Numeric(18, 4), default=0, comment="标准成本")
    safety_stock = Column(Numeric(18, 4), default=0, comment="安全库存")
    tax_rate = Column(Numeric(6, 4), default=0.13, comment="税率")
    status = Column(String(16), default="active", comment="active/inactive")
    remark = Column(Text)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    category = relationship("MaterialCategory")


class Supplier(Base):
    """供应商档案"""
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(32), unique=True, nullable=False, comment="供应商编码")
    name = Column(String(128), nullable=False, comment="供应商名称")
    short_name = Column(String(64), comment="简称")
    contact_person = Column(String(64), comment="联系人")
    contact_phone = Column(String(32))
    email = Column(String(128))
    address = Column(String(256))
    bank_name = Column(String(128), comment="开户银行")
    bank_account = Column(String(64), comment="银行账号")
    tax_number = Column(String(64), comment="税号")
    payment_terms = Column(String(128), default="月结30天", comment="付款条件")
    rating = Column(String(4), default="B", comment="评级: A/B/C")
    status = Column(String(16), default="active")
    remark = Column(Text)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class Customer(Base):
    """客户档案"""
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(32), unique=True, nullable=False)
    name = Column(String(128), nullable=False)
    short_name = Column(String(64))
    contact_person = Column(String(64))
    contact_phone = Column(String(32))
    email = Column(String(128))
    address = Column(String(256))
    bank_name = Column(String(128))
    bank_account = Column(String(64))
    tax_number = Column(String(64))
    credit_limit = Column(Numeric(18, 2), default=0, comment="信用额度")
    payment_terms = Column(String(128), default="月结30天")
    status = Column(String(16), default="active")
    remark = Column(Text)
    created_at = Column(DateTime, default=func.now())


class Warehouse(Base):
    """仓库"""
    __tablename__ = "warehouses"
    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(32), unique=True, nullable=False)
    name = Column(String(64), nullable=False)
    address = Column(String(256))
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(16), default="active")
    created_at = Column(DateTime, default=func.now())


class BOM(Base):
    """物料清单（BOM）"""
    __tablename__ = "bom"
    id = Column(Integer, primary_key=True, autoincrement=True)
    parent_material_id = Column(Integer, ForeignKey("materials.id"), nullable=False, comment="父物料")
    child_material_id = Column(Integer, ForeignKey("materials.id"), nullable=False, comment="子物料")
    quantity = Column(Numeric(18, 6), nullable=False, comment="用量")
    unit = Column(String(32))
    remark = Column(Text)

    parent_material = relationship("Material", foreign_keys=[parent_material_id])
    child_material = relationship("Material", foreign_keys=[child_material_id])


# ============================================================
# 库存（3张）
# ============================================================

class Inventory(Base):
    """库存台账"""
    __tablename__ = "inventory"
    id = Column(Integer, primary_key=True, autoincrement=True)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    quantity = Column(Numeric(18, 4), default=0, comment="库存数量")
    locked_quantity = Column(Numeric(18, 4), default=0, comment="锁定数量（在途）")
    average_cost = Column(Numeric(18, 4), default=0, comment="移动平均成本")
    last_in_date = Column(DateTime)
    last_out_date = Column(DateTime)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    material = relationship("Material")
    warehouse = relationship("Warehouse")


class StockMovement(Base):
    """库存流水"""
    __tablename__ = "stock_movements"
    id = Column(Integer, primary_key=True, autoincrement=True)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    movement_type = Column(String(16), nullable=False, comment="in/out/transfer")
    source_type = Column(String(32), comment="来源单据类型: purchase_receipt/sales_delivery/stocktaking/etc")
    source_bill_no = Column(String(32), comment="来源单据编号")
    quantity = Column(Numeric(18, 4), nullable=False, comment="变动数量（正数入库/负数出库）")
    unit_cost = Column(Numeric(18, 4), comment="单位成本")
    balance_quantity = Column(Numeric(18, 4), comment="变动后库存")
    movement_date = Column(DateTime, default=func.now())
    remark = Column(Text)

    material = relationship("Material")


class Stocktaking(Base):
    """盘点单"""
    __tablename__ = "stocktaking"
    id = Column(Integer, primary_key=True, autoincrement=True)
    bill_no = Column(String(32), unique=True, nullable=False)
    bill_date = Column(Date, nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    status = Column(String(16), default="draft", comment="draft/submitted/audited")
    remark = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=func.now())
    audited_by = Column(Integer)
    audited_at = Column(DateTime)

    warehouse = relationship("Warehouse")


# ============================================================
# 采购单据（8张）
# ============================================================

class PurchaseRequest(Base):
    """采购申请单（表头）"""
    __tablename__ = "purchase_requests"
    id = Column(Integer, primary_key=True, autoincrement=True)
    bill_no = Column(String(32), unique=True, nullable=False)
    bill_date = Column(Date, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"))
    requester_id = Column(Integer, ForeignKey("users.id"), comment="申请人")
    expected_date = Column(Date, comment="期望到货日期")
    reason = Column(String(256), comment="申请原因")
    status = Column(String(16), default="draft", comment="draft/submitted/audited/linked/closed")
    remark = Column(Text)
    created_by = Column(Integer)
    created_at = Column(DateTime, default=func.now())
    audited_by = Column(Integer)
    audited_at = Column(DateTime)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    items = relationship("PurchaseRequestItem", back_populates="request", cascade="all, delete-orphan")


class PurchaseRequestItem(Base):
    """采购申请单明细"""
    __tablename__ = "purchase_request_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(Integer, ForeignKey("purchase_requests.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    quantity = Column(Numeric(18, 4), nullable=False, comment="申请数量")
    linked_quantity = Column(Numeric(18, 4), default=0, comment="已转采购订单数量")
    remark = Column(Text)

    request = relationship("PurchaseRequest", back_populates="items")
    material = relationship("Material")


class PurchaseOrder(Base):
    """采购订单（表头）"""
    __tablename__ = "purchase_orders"
    id = Column(Integer, primary_key=True, autoincrement=True)
    bill_no = Column(String(32), unique=True, nullable=False)
    bill_date = Column(Date, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"))
    buyer_id = Column(Integer, ForeignKey("users.id"), comment="采购员")
    currency = Column(String(8), default="CNY")
    total_amount = Column(Numeric(18, 2), default=0, comment="金额合计")
    total_tax = Column(Numeric(18, 2), default=0, comment="税额合计")
    total_amount_with_tax = Column(Numeric(18, 2), default=0, comment="价税合计")
    payment_terms = Column(String(128), comment="付款条件")
    expected_date = Column(Date, comment="预计交货日期")
    delivery_address = Column(String(256))
    status = Column(String(16), default="draft", comment="draft/submitted/audited/partial_receipt/receipted/closed")
    source_bill_type = Column(String(32), comment="源单类型: purchase_request")
    source_bill_no = Column(String(32), comment="源单编号")
    remark = Column(Text)
    created_by = Column(Integer)
    created_at = Column(DateTime, default=func.now())
    audited_by = Column(Integer)
    audited_at = Column(DateTime)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    supplier = relationship("Supplier")
    items = relationship("PurchaseOrderItem", back_populates="order", cascade="all, delete-orphan")


class PurchaseOrderItem(Base):
    """采购订单明细"""
    __tablename__ = "purchase_order_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    quantity = Column(Numeric(18, 4), nullable=False, comment="采购数量")
    unit_price = Column(Numeric(18, 4), nullable=False, comment="不含税单价")
    tax_rate = Column(Numeric(6, 4), default=0.13)
    amount = Column(Numeric(18, 2), default=0, comment="金额")
    tax_amount = Column(Numeric(18, 2), default=0, comment="税额")
    total_amount = Column(Numeric(18, 2), default=0, comment="价税合计")
    received_quantity = Column(Numeric(18, 4), default=0, comment="已入库数量")
    source_request_item_id = Column(Integer, comment="关联申请明细ID")
    remark = Column(Text)

    order = relationship("PurchaseOrder", back_populates="items")
    material = relationship("Material")


class PurchaseReceipt(Base):
    """采购入库单（表头）"""
    __tablename__ = "purchase_receipts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    bill_no = Column(String(32), unique=True, nullable=False)
    bill_date = Column(Date, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=True, comment="关联采购订单")
    order_no = Column(String(32), comment="采购订单号")
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"))
    total_quantity = Column(Numeric(18, 4), default=0)
    total_amount = Column(Numeric(18, 2), default=0)
    inspect_status = Column(String(16), default="pending", comment="pending/qualified/unqualified")
    status = Column(String(16), default="draft", comment="draft/submitted/audited")
    source_bill_type = Column(String(32), comment="purchase_order")
    remark = Column(Text)
    created_by = Column(Integer)
    created_at = Column(DateTime, default=func.now())
    audited_by = Column(Integer)
    audited_at = Column(DateTime)

    supplier = relationship("Supplier")
    warehouse = relationship("Warehouse")
    items = relationship("PurchaseReceiptItem", back_populates="receipt", cascade="all, delete-orphan")


class PurchaseReceiptItem(Base):
    """采购入库单明细"""
    __tablename__ = "purchase_receipt_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    receipt_id = Column(Integer, ForeignKey("purchase_receipts.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    order_item_id = Column(Integer, comment="关联订单明细ID")
    order_quantity = Column(Numeric(18, 4), comment="订单数量")
    received_quantity = Column(Numeric(18, 4), nullable=False, comment="实收数量")
    qualified_quantity = Column(Numeric(18, 4), comment="合格数量")
    unit_price = Column(Numeric(18, 4), comment="单价")
    amount = Column(Numeric(18, 2), default=0)
    batch_no = Column(String(32), comment="批次号")
    remark = Column(Text)

    receipt = relationship("PurchaseReceipt", back_populates="items")
    material = relationship("Material")


class PurchaseReturn(Base):
    """采购退货单（表头）"""
    __tablename__ = "purchase_returns"
    id = Column(Integer, primary_key=True, autoincrement=True)
    bill_no = Column(String(32), unique=True, nullable=False)
    bill_date = Column(Date, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    receipt_id = Column(Integer, ForeignKey("purchase_receipts.id"), nullable=True, comment="关联入库单")
    receipt_no = Column(String(32))
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    total_quantity = Column(Numeric(18, 4), default=0)
    total_amount = Column(Numeric(18, 2), default=0)
    return_reason = Column(String(256), comment="退货原因")
    status = Column(String(16), default="draft", comment="draft/submitted/audited")
    remark = Column(Text)
    created_by = Column(Integer)
    created_at = Column(DateTime, default=func.now())
    audited_by = Column(Integer)
    audited_at = Column(DateTime)

    supplier = relationship("Supplier")
    items = relationship("PurchaseReturnItem", back_populates="return_bill", cascade="all, delete-orphan")


class PurchaseReturnItem(Base):
    """采购退货单明细"""
    __tablename__ = "purchase_return_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    return_id = Column(Integer, ForeignKey("purchase_returns.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    return_quantity = Column(Numeric(18, 4), nullable=False, comment="退货数量")
    unit_price = Column(Numeric(18, 4))
    amount = Column(Numeric(18, 2), default=0)
    remark = Column(Text)

    return_bill = relationship("PurchaseReturn", back_populates="items")
    material = relationship("Material")


# ============================================================
# 销售单据（6张）
# ============================================================

class SalesOrder(Base):
    """销售订单（表头）"""
    __tablename__ = "sales_orders"
    id = Column(Integer, primary_key=True, autoincrement=True)
    bill_no = Column(String(32), unique=True, nullable=False)
    bill_date = Column(Date, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    salesperson_id = Column(Integer, ForeignKey("users.id"))
    currency = Column(String(8), default="CNY")
    total_amount = Column(Numeric(18, 2), default=0)
    total_tax = Column(Numeric(18, 2), default=0)
    total_amount_with_tax = Column(Numeric(18, 2), default=0)
    payment_terms = Column(String(128))
    expected_delivery_date = Column(Date)
    delivery_address = Column(String(256))
    status = Column(String(16), default="draft", comment="draft/submitted/audited/partial_delivery/delivered/closed")
    remark = Column(Text)
    created_by = Column(Integer)
    created_at = Column(DateTime, default=func.now())
    audited_by = Column(Integer)
    audited_at = Column(DateTime)

    customer = relationship("Customer")
    items = relationship("SalesOrderItem", back_populates="order", cascade="all, delete-orphan")


class SalesOrderItem(Base):
    """销售订单明细"""
    __tablename__ = "sales_order_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("sales_orders.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    quantity = Column(Numeric(18, 4), nullable=False)
    unit_price = Column(Numeric(18, 4), nullable=False)
    tax_rate = Column(Numeric(6, 4), default=0.13)
    amount = Column(Numeric(18, 2), default=0)
    tax_amount = Column(Numeric(18, 2), default=0)
    total_amount = Column(Numeric(18, 2), default=0)
    delivered_quantity = Column(Numeric(18, 4), default=0, comment="已出库数量")
    remark = Column(Text)

    order = relationship("SalesOrder", back_populates="items")
    material = relationship("Material")


class SalesDelivery(Base):
    """销售出库单（表头）"""
    __tablename__ = "sales_deliveries"
    id = Column(Integer, primary_key=True, autoincrement=True)
    bill_no = Column(String(32), unique=True, nullable=False)
    bill_date = Column(Date, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("sales_orders.id"), nullable=True)
    order_no = Column(String(32))
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    total_quantity = Column(Numeric(18, 4), default=0)
    total_amount = Column(Numeric(18, 2), default=0)
    status = Column(String(16), default="draft")
    remark = Column(Text)
    created_by = Column(Integer)
    created_at = Column(DateTime, default=func.now())
    audited_by = Column(Integer)
    audited_at = Column(DateTime)

    customer = relationship("Customer")
    warehouse = relationship("Warehouse")
    items = relationship("SalesDeliveryItem", back_populates="delivery", cascade="all, delete-orphan")


class SalesDeliveryItem(Base):
    """销售出库单明细"""
    __tablename__ = "sales_delivery_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    delivery_id = Column(Integer, ForeignKey("sales_deliveries.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    order_item_id = Column(Integer)
    order_quantity = Column(Numeric(18, 4))
    delivered_quantity = Column(Numeric(18, 4), nullable=False)
    unit_price = Column(Numeric(18, 4))
    amount = Column(Numeric(18, 2), default=0)
    remark = Column(Text)

    delivery = relationship("SalesDelivery", back_populates="items")
    material = relationship("Material")


class SalesReturn(Base):
    """销售退货单（表头）"""
    __tablename__ = "sales_returns"
    id = Column(Integer, primary_key=True, autoincrement=True)
    bill_no = Column(String(32), unique=True, nullable=False)
    bill_date = Column(Date, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    total_quantity = Column(Numeric(18, 4), default=0)
    total_amount = Column(Numeric(18, 2), default=0)
    return_reason = Column(String(256))
    status = Column(String(16), default="draft")
    remark = Column(Text)
    created_by = Column(Integer)
    created_at = Column(DateTime, default=func.now())

    customer = relationship("Customer")
    items = relationship("SalesReturnItem", back_populates="return_bill", cascade="all, delete-orphan")


class SalesReturnItem(Base):
    """销售退货单明细"""
    __tablename__ = "sales_return_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    return_id = Column(Integer, ForeignKey("sales_returns.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    return_quantity = Column(Numeric(18, 4), nullable=False)
    unit_price = Column(Numeric(18, 4))
    amount = Column(Numeric(18, 2), default=0)
    remark = Column(Text)

    return_bill = relationship("SalesReturn", back_populates="items")
    material = relationship("Material")


# ============================================================
# 财务（5张）
# ============================================================

class Payable(Base):
    """应付账款"""
    __tablename__ = "payables"
    id = Column(Integer, primary_key=True, autoincrement=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    bill_type = Column(String(32), comment="单据类型: purchase_receipt/purchase_return")
    bill_no = Column(String(32), comment="来源单据编号")
    bill_date = Column(Date)
    amount = Column(Numeric(18, 2), nullable=False, comment="应付金额")
    paid_amount = Column(Numeric(18, 2), default=0, comment="已付金额")
    balance = Column(Numeric(18, 2), default=0, comment="未付余额")
    status = Column(String(16), default="unpaid", comment="unpaid/partial/paid")
    due_date = Column(Date, comment="到期日期")
    remark = Column(Text)
    created_at = Column(DateTime, default=func.now())

    supplier = relationship("Supplier")


class Receivable(Base):
    """应收账款"""
    __tablename__ = "receivables"
    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    bill_type = Column(String(32), comment="sales_delivery/sales_return")
    bill_no = Column(String(32))
    bill_date = Column(Date)
    amount = Column(Numeric(18, 2), nullable=False)
    received_amount = Column(Numeric(18, 2), default=0)
    balance = Column(Numeric(18, 2), default=0)
    status = Column(String(16), default="unpaid")
    due_date = Column(Date)
    remark = Column(Text)
    created_at = Column(DateTime, default=func.now())

    customer = relationship("Customer")


class Payment(Base):
    """付款单"""
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    bill_no = Column(String(32), unique=True, nullable=False)
    bill_date = Column(Date, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    payment_method = Column(String(32), comment="bank/cash/check")
    bank_account = Column(String(64), comment="付款账号")
    total_amount = Column(Numeric(18, 2), nullable=False, comment="付款总额")
    status = Column(String(16), default="draft", comment="draft/submitted/audited")
    remark = Column(Text)
    created_by = Column(Integer)
    created_at = Column(DateTime, default=func.now())
    audited_by = Column(Integer)
    audited_at = Column(DateTime)

    supplier = relationship("Supplier")
    items = relationship("PaymentItem", back_populates="payment", cascade="all, delete-orphan")


class PaymentItem(Base):
    """付款单核销明细"""
    __tablename__ = "payment_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=False)
    payable_id = Column(Integer, ForeignKey("payables.id"), nullable=False)
    payable_bill_no = Column(String(32))
    payable_amount = Column(Numeric(18, 2), comment="应付金额")
    this_payment = Column(Numeric(18, 2), nullable=False, comment="本次付款")

    payment = relationship("Payment", back_populates="items")


class Receipt(Base):
    """收款单"""
    __tablename__ = "receipts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    bill_no = Column(String(32), unique=True, nullable=False)
    bill_date = Column(Date, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    payment_method = Column(String(32))
    bank_account = Column(String(64))
    total_amount = Column(Numeric(18, 2), nullable=False)
    status = Column(String(16), default="draft")
    remark = Column(Text)
    created_by = Column(Integer)
    created_at = Column(DateTime, default=func.now())
    audited_by = Column(Integer)
    audited_at = Column(DateTime)

    customer = relationship("Customer")
    items = relationship("ReceiptItem", back_populates="receipt", cascade="all, delete-orphan")


class ReceiptItem(Base):
    """收款单核销明细"""
    __tablename__ = "receipt_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id"), nullable=False)
    receivable_id = Column(Integer, ForeignKey("receivables.id"), nullable=False)
    receivable_bill_no = Column(String(32))
    receivable_amount = Column(Numeric(18, 2))
    this_receipt = Column(Numeric(18, 2), nullable=False)

    receipt = relationship("Receipt", back_populates="items")


# ============================================================
# 学习模式（5张）
# ============================================================

class LearningProgress(Base):
    """学习进度"""
    __tablename__ = "learning_progress"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), default=1)
    course_id = Column(String(32), nullable=False, comment="课程编号: tour_01 ~ tour_12")
    course_name = Column(String(128))
    status = Column(String(16), default="not_started", comment="not_started/in_progress/completed")
    progress = Column(Integer, default=0, comment="进度百分比")
    score = Column(Integer, comment="最高得分")
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class LearningScenario(Base):
    """实战场景"""
    __tablename__ = "learning_scenarios"
    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(8), unique=True, nullable=False, comment="S01 ~ S10")
    name = Column(String(128), nullable=False)
    difficulty = Column(Integer, default=1, comment="1/2/3")
    background = Column(Text, comment="场景背景")
    role = Column(String(64), comment="扮演角色")
    objectives = Column(Text, comment="任务目标 JSON")
    constraints = Column(Text, comment="约束条件 JSON")
    checkpoints = Column(Text, comment="检查点 JSON")
    modules = Column(String(128), comment="涉及模块")
    estimated_time = Column(Integer, comment="预计用时(分钟)")
    status = Column(String(16), default="active")


class ScenarioResult(Base):
    """场景完成结果"""
    __tablename__ = "scenario_results"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, default=1)
    scenario_code = Column(String(8), nullable=False)
    started_at = Column(DateTime, default=func.now())
    completed_at = Column(DateTime)
    total_score = Column(Numeric(5, 2), comment="总分")
    accuracy_score = Column(Numeric(5, 2), comment="准确性得分")
    completeness_score = Column(Numeric(5, 2), comment="完整性得分")
    compliance_score = Column(Numeric(5, 2), comment="合规性得分")
    efficiency_score = Column(Numeric(5, 2), comment="效率性得分")
    feedback = Column(Text, comment="反馈 JSON")
    status = Column(String(16), default="in_progress")


class OperationLog(Base):
    """操作日志"""
    __tablename__ = "operation_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, default=1)
    module = Column(String(32), comment="操作模块")
    action = Column(String(64), comment="操作动作")
    target_bill_type = Column(String(32), comment="操作单据类型")
    target_bill_no = Column(String(32), comment="操作单据编号")
    detail = Column(Text, comment="操作详情 JSON")
    scenario_code = Column(String(8), comment="场景编号（场景模式下记录）")
    created_at = Column(DateTime, default=func.now())


class OperationScore(Base):
    """操作评分记录"""
    __tablename__ = "operation_scores"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, default=1)
    module = Column(String(32))
    action = Column(String(64))
    target_bill_no = Column(String(32))
    accuracy_score = Column(Numeric(5, 2))
    completeness_score = Column(Numeric(5, 2))
    compliance_score = Column(Numeric(5, 2))
    efficiency_score = Column(Numeric(5, 2))
    total_score = Column(Numeric(5, 2))
    feedback = Column(Text, comment="反馈 JSON")
    created_at = Column(DateTime, default=func.now())

"""知雀ERP - 种子数据生成器

生成一套完整的制造业ERP种子数据，覆盖：
基础档案、库存、采购、销售、财务、学习模式等全部模块。
数据模拟一家持续经营6个月的制造企业，具备真实的业务关联与余额。
"""
import json
import os
import random
import sys
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

# 确保能 import models / database
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database import Base, SessionLocal, engine
from models import (
    # 基础数据
    Department, User, MaterialCategory, Material, Supplier, Customer,
    Warehouse, BOM,
    # 库存
    Inventory, StockMovement,
    # 采购
    PurchaseOrder, PurchaseOrderItem,
    PurchaseReceipt, PurchaseReceiptItem,
    # 销售
    SalesOrder, SalesOrderItem,
    SalesDelivery, SalesDeliveryItem,
    # 财务
    Payable, Receivable, Payment, PaymentItem, Receipt, ReceiptItem,
    # 学习
    LearningProgress, LearningScenario,
)

# ============================================================
# 通用工具
# ============================================================

random.seed(42)  # 可复现

TODAY = date(2026, 6, 18)
SIX_MONTHS_AGO = TODAY - timedelta(days=180)
THREE_MONTHS_AGO = TODAY - timedelta(days=90)


def money(value: Decimal, places: int = 2) -> Decimal:
    """规范化金额到指定小数位。"""
    q = Decimal(10) ** -places
    return value.quantize(q, rounding=ROUND_HALF_UP)


def rand_date(start: date = SIX_MONTHS_AGO, end: date = TODAY) -> date:
    """在指定范围内随机生成日期。"""
    delta = (end - start).days
    if delta <= 0:
        return start
    return start + timedelta(days=random.randint(0, delta))


def rand_datetime(start: date = SIX_MONTHS_AGO, end: date = TODAY) -> datetime:
    d = rand_date(start, end)
    return datetime(d.year, d.month, d.day,
                    random.randint(8, 18), random.randint(0, 59), random.randint(0, 59))


def pick(seq, default=None):
    if not seq:
        return default
    return random.choice(seq)


def pick_sample(seq, k):
    if len(seq) <= k:
        return list(seq)
    return random.sample(seq, k)


# ============================================================
# 1. 清空数据
# ============================================================

def clear_data(db):
    """按依赖顺序删除所有业务数据。"""
    print(">> 清空现有数据 ...")
    # 删除顺序：先删子表/明细，再删主表
    table_order = [
        # 学习
        "operation_logs",
        "operation_scores",
        "scenario_results",
        "learning_scenarios",
        "learning_progress",
        # 财务
        "receipt_items",
        "receipts",
        "payment_items",
        "payments",
        "receivables",
        "payables",
        # 销售
        "sales_return_items",
        "sales_returns",
        "sales_delivery_items",
        "sales_deliveries",
        "sales_order_items",
        "sales_orders",
        # 采购
        "purchase_return_items",
        "purchase_returns",
        "purchase_receipt_items",
        "purchase_receipts",
        "purchase_order_items",
        "purchase_orders",
        "purchase_request_items",
        "purchase_requests",
        # 库存
        "stock_movements",
        "stocktaking",
        "inventory",
        # 基础
        "bom",
        "warehouses",
        "customers",
        "suppliers",
        "materials",
        "material_categories",
        "users",
        "departments",
    ]
    from sqlalchemy import text
    for tbl in table_order:
        db.execute(text(f"DELETE FROM {tbl}"))
    # 重置自增序列（SQLite）— sqlite_sequence 表仅在含 AUTOINCREMENT 列的表存在时才有
    try:
        for tbl in table_order:
            db.execute(text(f"DELETE FROM sqlite_sequence WHERE name='{tbl}'"))
    except Exception:
        pass  # sqlite_sequence 表可能不存在，忽略即可
    db.commit()
    print("   已清空全部表。")


# ============================================================
# 2. 部门
# ============================================================

def create_departments(db):
    print(">> 创建部门 ...")
    departments = [
        ("DP01", "采购部"),
        ("DP02", "生产部"),
        ("DP03", "仓储部"),
        ("DP04", "销售部"),
        ("DP05", "财务部"),
    ]
    objs = []
    for code, name in departments:
        d = Department(code=code, name=name)
        db.add(d)
        objs.append(d)
    db.flush()
    return {d.code: d for d in objs}


# ============================================================
# 3. 用户
# ============================================================

def create_users(db, dept_map):
    print(">> 创建用户 ...")
    users_def = [
        # username, real_name, role, dept_code, phone, email
        ("admin", "管理员", "admin", None, "13800000001", "admin@zhique.com"),
        ("zhangming", "张明", "buyer", "DP01", "13800000002", "zhangming@zhique.com"),
        ("lili", "李丽", "buyer", "DP01", "13800000003", "lili@zhique.com"),
        ("wangqiang", "王强", "warehouse", "DP03", "13800000004", "wangqiang@zhique.com"),
        ("zhaoxin", "赵欣", "finance", "DP05", "13800000005", "zhaoxin@zhique.com"),
        ("sunwei", "孙伟", "sales", "DP04", "13800000006", "sunwei@zhique.com"),
    ]
    objs = []
    for username, real_name, role, dept_code, phone, email in users_def:
        u = User(
            username=username,
            password="123456",
            real_name=real_name,
            role=role,
            department_id=dept_map[dept_code].id if dept_code else None,
            phone=phone,
            email=email,
            is_active=True,
        )
        db.add(u)
        objs.append(u)
    db.flush()
    return {u.username: u for u in objs}


# ============================================================
# 4. 仓库
# ============================================================

def create_warehouses(db, user_map):
    print(">> 创建仓库 ...")
    whs = [
        ("W01", "原料仓", "厂区A栋-1F", user_map["wangqiang"].id),
        ("W02", "半成品仓", "厂区A栋-2F", user_map["wangqiang"].id),
        ("W03", "成品仓", "厂区B栋-1F", user_map["wangqiang"].id),
    ]
    objs = []
    for code, name, addr, mgr_id in whs:
        w = Warehouse(code=code, name=name, address=addr, manager_id=mgr_id, status="active")
        db.add(w)
        objs.append(w)
    db.flush()
    return {w.code: w for w in objs}


# ============================================================
# 5. 物料分类
# ============================================================

def create_categories(db):
    print(">> 创建物料分类 ...")
    cats = [
        ("CAT01", "原材料", None, 1),
        ("CAT02", "半成品", None, 2),
        ("CAT03", "成品", None, 3),
    ]
    objs = []
    for code, name, parent, sort in cats:
        c = MaterialCategory(code=code, name=name, parent_id=parent, sort_order=sort)
        db.add(c)
        objs.append(c)
    db.flush()
    return {c.code: c for c in objs}


# ============================================================
# 6. 物料档案
# ============================================================

def create_materials(db, cat_map):
    print(">> 创建物料档案 ...")
    materials = []

    # ---- 原材料 40 个 ----
    raw_defs = [
        # (name, specification, unit, standard_price, safety_stock, tax_rate)
        # 冷轧钢板
        ("冷轧钢板 1.0mm", "SPCC 1.0×1250×2500mm", "张", Decimal("85.00"), Decimal("200"), Decimal("0.13")),
        ("冷轧钢板 1.2mm", "SPCC 1.2×1250×2500mm", "张", Decimal("98.00"), Decimal("200"), Decimal("0.13")),
        ("冷轧钢板 1.5mm", "SPCC 1.5×1250×2500mm", "张", Decimal("115.00"), Decimal("150"), Decimal("0.13")),
        ("冷轧钢板 2.0mm", "SPCC 2.0×1250×2500mm", "张", Decimal("145.00"), Decimal("150"), Decimal("0.13")),
        # 不锈钢
        ("不锈钢板 304 1.0mm", "SUS304 1.0×1220×2440mm", "张", Decimal("320.00"), Decimal("80"), Decimal("0.13")),
        ("不锈钢板 304 2.0mm", "SUS304 2.0×1220×2440mm", "张", Decimal("520.00"), Decimal("60"), Decimal("0.13")),
        # 铝材
        ("铝板 5052 1.5mm", "5052-H32 1.5×1220×2440mm", "张", Decimal("260.00"), Decimal("80"), Decimal("0.13")),
        ("铝型材 4040", "欧标4040工业铝型材 6m/支", "支", Decimal("78.00"), Decimal("300"), Decimal("0.13")),
        # 铜材
        ("铜线 Φ0.5mm", "T2紫铜线 Φ0.5mm", "kg", Decimal("65.00"), Decimal("100"), Decimal("0.13")),
        ("铜棒 Φ20mm", "H59黄铜棒 Φ20mm", "kg", Decimal("45.00"), Decimal("80"), Decimal("0.13")),
        # 电阻
        ("贴片电阻 0805 10KΩ", "RC0805FR-0710KL ±1%", "个", Decimal("0.08"), Decimal("50000"), Decimal("0.13")),
        ("贴片电阻 0805 1KΩ", "RC0805FR-071KL ±1%", "个", Decimal("0.08"), Decimal("50000"), Decimal("0.13")),
        ("贴片电阻 0603 100Ω", "RC0603FR-07100RL ±1%", "个", Decimal("0.06"), Decimal("80000"), Decimal("0.13")),
        ("色环电阻 1/4W 10KΩ", "CF1/4W-10K ±5%", "个", Decimal("0.05"), Decimal("30000"), Decimal("0.13")),
        ("水泥电阻 5W 10Ω", "RX24-5W 10Ω ±5%", "个", Decimal("0.35"), Decimal("5000"), Decimal("0.13")),
        # 电容
        ("贴片电容 0805 100nF", "CL21B104KBCNNNC X7R 50V", "个", Decimal("0.09"), Decimal("60000"), Decimal("0.13")),
        ("贴片电容 0805 10uF", "CL21A106KAYNNNE X5R 16V", "个", Decimal("0.22"), Decimal("40000"), Decimal("0.13")),
        ("电解电容 100uF/25V", "CD110 100uF 25V ±20%", "个", Decimal("0.18"), Decimal("20000"), Decimal("0.13")),
        ("电解电容 470uF/35V", "CD110 470uF 35V ±20%", "个", Decimal("0.45"), Decimal("10000"), Decimal("0.13")),
        ("安规电容 0.1uF/275V", "CBB22 0.1uF 275VAC", "个", Decimal("0.85"), Decimal("8000"), Decimal("0.13")),
        # IC芯片
        ("STM32F103C8T6", "STM32F103C8T6 LQFP48", "个", Decimal("9.50"), Decimal("2000"), Decimal("0.13")),
        ("LM358DR", "LM358DR SOIC-8 双运放", "个", Decimal("0.65"), Decimal("8000"), Decimal("0.13")),
        ("TL494CN", "TL494CN DIP-16 PWM", "个", Decimal("1.20"), Decimal("5000"), Decimal("0.13")),
        ("AMS1117-3.3", "AMS1117-3.3 SOT-223 LDO", "个", Decimal("0.25"), Decimal("10000"), Decimal("0.13")),
        ("PC817C", "PC817C DIP-4 光耦", "个", Decimal("0.35"), Decimal("10000"), Decimal("0.13")),
        # 连接器
        ("接线端子 2P 5.08mm", "KF128-2P-5.08 接线端子", "个", Decimal("0.45"), Decimal("10000"), Decimal("0.13")),
        ("DB9母头", "DB9F 焊接式 D-Sub连接器", "个", Decimal("1.80"), Decimal("5000"), Decimal("0.13")),
        ("JST PH 2.0 2P", "PH2.0-2P 线对板连接器", "个", Decimal("0.15"), Decimal("20000"), Decimal("0.13")),
        ("USB Type-C 母座", "TYPE-C-31-M-12 USB-C", "个", Decimal("0.85"), Decimal("8000"), Decimal("0.13")),
        ("IDC 40P 排针", "2.54mm 2×20 直插排针", "个", Decimal("0.30"), Decimal("10000"), Decimal("0.13")),
        # 塑料
        ("ABS颗粒", "ABS 750A 注塑级 25kg/袋", "kg", Decimal("14.50"), Decimal("500"), Decimal("0.13")),
        ("PC颗粒", "PC 1100 注塑级 25kg/袋", "kg", Decimal("22.00"), Decimal("300"), Decimal("0.13")),
        ("PA66颗粒", "PA66 GF30 增强级 25kg/袋", "kg", Decimal("26.00"), Decimal("200"), Decimal("0.13")),
        ("POM颗粒", "POM M90 注塑级 25kg/袋", "kg", Decimal("16.50"), Decimal("200"), Decimal("0.13")),
        ("PP颗粒", "PP T30S 注塑级 25kg/袋", "kg", Decimal("10.50"), Decimal("400"), Decimal("0.13")),
        # 紧固件
        ("十字盘头螺钉 M3×8", "SUS304 M3×8 GB/T818", "个", Decimal("0.03"), Decimal("50000"), Decimal("0.13")),
        ("内六角螺钉 M4×10", "12.9级 M4×10 GB/T70.1", "个", Decimal("0.08"), Decimal("30000"), Decimal("0.13")),
        ("六角螺母 M4", "SUS304 M4 GB/T6170", "个", Decimal("0.03"), Decimal("40000"), Decimal("0.13")),
        ("平垫圈 M3", "SUS304 M3 GB/T97.1", "个", Decimal("0.01"), Decimal("80000"), Decimal("0.13")),
        ("弹簧垫圈 M4", "SUS304 M4 GB/T93", "个", Decimal("0.02"), Decimal("60000"), Decimal("0.13")),
    ]
    for idx, (name, spec, unit, price, safety, tax) in enumerate(raw_defs, start=1):
        code = f"RM{idx:03d}"
        m = Material(
            code=code,
            name=name,
            specification=spec,
            unit=unit,
            material_type="raw",
            category_id=cat_map["CAT01"].id,
            standard_price=price,
            standard_cost=price,
            safety_stock=safety,
            tax_rate=tax,
            status="active",
        )
        db.add(m)
        materials.append(m)

    # ---- 半成品 15 个 ----
    semi_defs = [
        ("冲压外壳件A", "SPCC 1.0mm 冲压成型 100×80×40mm", "个", Decimal("6.50"), Decimal("500"), Decimal("0.13")),
        ("冲压外壳件B", "SPCC 1.5mm 冲压成型 120×100×50mm", "个", Decimal("8.80"), Decimal("400"), Decimal("0.13")),
        ("冲压支架", "SUS304 2.0mm 冲压 L型支架", "个", Decimal("5.20"), Decimal("600"), Decimal("0.13")),
        ("铝散热片40mm", "6063铝挤压 40×40×20mm 齿形", "个", Decimal("3.80"), Decimal("800"), Decimal("0.13")),
        ("PCBA-电源板", "120×80mm FR-4 电源板 PCBA", "块", Decimal("58.00"), Decimal("200"), Decimal("0.13")),
        ("PCBA-控制板", "100×80mm FR-4 控制板 PCBA", "块", Decimal("72.00"), Decimal("200"), Decimal("0.13")),
        ("PCBA-驱动板", "80×60mm FR-4 驱动板 PCBA", "块", Decimal("45.00"), Decimal("300"), Decimal("0.13")),
        ("注塑外壳-上盖", "ABS 黑色 上盖 150×100×30mm", "个", Decimal("9.50"), Decimal("500"), Decimal("0.13")),
        ("注塑外壳-下盖", "ABS 黑色 下盖 150×100×30mm", "个", Decimal("9.00"), Decimal("500"), Decimal("0.13")),
        ("注塑面板", "PC 透明面板 120×80×3mm", "个", Decimal("6.80"), Decimal("400"), Decimal("0.13")),
        ("线束总成A", "AWG24 线束 300mm 带JST PH2.0-4P", "条", Decimal("4.20"), Decimal("1000"), Decimal("0.13")),
        ("线束总成B", "AWG22 线束 500mm 带DB9焊片", "条", Decimal("6.50"), Decimal("800"), Decimal("0.13")),
        ("铜排连接件", "T2紫铜 镀镍 30×3×80mm", "件", Decimal("12.00"), Decimal("300"), Decimal("0.13")),
        ("变压器骨架", "EE25 骨架 立式", "套", Decimal("2.50"), Decimal("2000"), Decimal("0.13")),
        ("冲压端子排", "H62黄铜 10位端子排 冲压", "排", Decimal("3.20"), Decimal("1000"), Decimal("0.13")),
    ]
    for idx, (name, spec, unit, price, safety, tax) in enumerate(semi_defs, start=1):
        code = f"SF{idx:03d}"
        m = Material(
            code=code,
            name=name,
            specification=spec,
            unit=unit,
            material_type="semi",
            category_id=cat_map["CAT02"].id,
            standard_price=price,
            standard_cost=price,
            safety_stock=safety,
            tax_rate=tax,
            status="active",
        )
        db.add(m)
        materials.append(m)

    # ---- 成品 25 个 ----
    finished_defs = [
        ("精密连接器 24芯", "JZH-24P 精密板对板连接器 2.54mm", "套", Decimal("38.00"), Decimal("300"), Decimal("0.13")),
        ("精密连接器 40芯", "JZH-40P 精密板对板连接器 2.54mm", "套", Decimal("55.00"), Decimal("300"), Decimal("0.13")),
        ("工业控制板 v2.0", "STM32 485 工业控制板 120×80mm", "块", Decimal("185.00"), Decimal("100"), Decimal("0.13")),
        ("电机驱动板 5A", "BLDC驱动 24V 5A 驱动板", "块", Decimal("165.00"), Decimal("100"), Decimal("0.13")),
        ("温度传感器模块", "PT100 温度采集模块 4-20mA", "套", Decimal("78.00"), Decimal("200"), Decimal("0.13")),
        ("压力传感器模块", "0-1MPa 压力变送器模块 4-20mA", "套", Decimal("95.00"), Decimal("200"), Decimal("0.13")),
        ("电流传感器模块", "0-50A 霍尔电流传感器模块", "套", Decimal("68.00"), Decimal("200"), Decimal("0.13")),
        ("电源模块 12V/5A", "AC/DC 220V转12V/5A 开关电源", "台", Decimal("62.00"), Decimal("150"), Decimal("0.13")),
        ("电源模块 24V/10A", "AC/DC 220V转24V/10A 开源电源", "台", Decimal("125.00"), Decimal("100"), Decimal("0.13")),
        ("数据采集卡 8路", "8路12位ADC 485通信 数据采集卡", "块", Decimal("220.00"), Decimal("80"), Decimal("0.13")),
        ("继电器输出模块", "8路继电器输出 485通信", "块", Decimal("135.00"), Decimal("100"), Decimal("0.13")),
        ("隔离栅 4-20mA", "一进一出 安全栅 4-20mA隔离", "台", Decimal("88.00"), Decimal("150"), Decimal("0.13")),
        ("RS485集线器", "4口RS485集线器 工业级", "台", Decimal("115.00"), Decimal("100"), Decimal("0.13")),
        ("CAN转换网关", "CAN转485/以太网 网关", "台", Decimal("280.00"), Decimal("60"), Decimal("0.13")),
        ("工业平板 7寸", "7寸工业触摸平板 ARM A53 2GB/16GB", "台", Decimal("680.00"), Decimal("50"), Decimal("0.13")),
        ("仪表壳体组件A", "96×96 仪表壳体总成 含面板", "套", Decimal("45.00"), Decimal("200"), Decimal("0.13")),
        ("仪表壳体组件B", "72×72 仪表壳体总成 含面板", "套", Decimal("38.00"), Decimal("200"), Decimal("0.13")),
        ("变频器控制板", "2.2kW变频器主控板", "块", Decimal("250.00"), Decimal("80"), Decimal("0.13")),
        ("PLC扩展模块", "16DI/16DO PLC扩展模块", "块", Decimal("320.00"), Decimal("60"), Decimal("0.13")),
        ("无线通信模块", "LoRa 433MHz 20dBm 通信模块", "块", Decimal("98.00"), Decimal("150"), Decimal("0.13")),
        ("智能仪表 485", "三相电力仪表 RS485 4-20mA", "台", Decimal("195.00"), Decimal("100"), Decimal("0.13")),
        ("适配器 12V/2A", "12V/2A 电源适配器 认证款", "个", Decimal("18.50"), Decimal("500"), Decimal("0.13")),
        ("适配器 24V/2A", "24V/2A 电源适配器 认证款", "个", Decimal("26.00"), Decimal("500"), Decimal("0.13")),
        ("调试线缆套装", "USB转485/232 调试线缆套装", "套", Decimal("32.00"), Decimal("200"), Decimal("0.13")),
        ("整机控制柜", "600×400×200 控制柜 含电源/端子", "台", Decimal("850.00"), Decimal("30"), Decimal("0.13")),
    ]
    for idx, (name, spec, unit, price, safety, tax) in enumerate(finished_defs, start=1):
        code = f"FG{idx:03d}"
        m = Material(
            code=code,
            name=name,
            specification=spec,
            unit=unit,
            material_type="finished",
            category_id=cat_map["CAT03"].id,
            standard_price=price,
            standard_cost=price,
            safety_stock=safety,
            tax_rate=tax,
            status="active",
        )
        db.add(m)
        materials.append(m)

    db.flush()
    print(f"   共创建 {len(materials)} 条物料。")
    return materials


def group_materials(materials):
    raws = [m for m in materials if m.material_type == "raw"]
    semis = [m for m in materials if m.material_type == "semi"]
    fgs = [m for m in materials if m.material_type == "finished"]
    return raws, semis, fgs


# ============================================================
# 7. 供应商
# ============================================================

def create_suppliers(db):
    print(">> 创建供应商 ...")
    suppliers_def = [
        # (name, short_name, contact, phone, rating, payment_terms)
        ("恒达钢业有限公司", "恒达钢业", "周经理", "13901001001", "A", "月结30天"),
        ("宝钢集团有限公司", "宝钢集团", "李经理", "13901001002", "A", "月结45天"),
        ("沙钢集团有限公司", "沙钢集团", "张经理", "13901001003", "A", "月结30天"),
        ("南山铝业有限公司", "南山铝业", "王经理", "13901001004", "A", "月结30天"),
        ("江铜集团有限公司", "江铜集团", "刘经理", "13901001005", "A", "月结45天"),
        ("风华高科股份有限公司", "风华高科", "陈经理", "13901001006", "A", "月结30天"),
        ("顺络电子股份有限公司", "顺络电子", "黄经理", "13901001007", "B", "月结30天"),
        ("江海电容器有限公司", "江海电容", "赵经理", "13901001008", "B", "月结30天"),
        ("意法半导体(中国)投资有限公司", "意法半导体", "吴经理", "13901001009", "A", "款到发货"),
        ("德州仪器(上海)有限公司", "德州仪器", "徐经理", "13901001010", "A", "款到发货"),
        ("安富利电子(上海)有限公司", "安富利", "孙经理", "13901001011", "B", "月结15天"),
        ("文晔科技(上海)有限公司", "文晔科技", "胡经理", "13901001012", "B", "月结15天"),
        ("立创电子商城有限公司", "立创电子", "朱经理", "13901001013", "B", "款到发货"),
        ("得润电子股份有限公司", "得润电子", "林经理", "13901001014", "B", "月结30天"),
        ("中航光电科技股份有限公司", "中航光电", "何经理", "13901001015", "A", "月结45天"),
        ("塑金高分子材料有限公司", "塑金材料", "高经理", "13901001016", "B", "月结30天"),
        ("巴斯夫(中国)有限公司", "巴斯夫", "罗经理", "13901001017", "A", "月结45天"),
        ("东明紧固件有限公司", "东明紧固件", "梁经理", "13901001018", "B", "月结30天"),
        ("沪东五金制品厂", "沪东五金", "宋经理", "13901001019", "C", "款到发货"),
        ("城东塑料颗粒加工厂", "城东塑料", "谢经理", "13901001020", "C", "款到发货"),
        ("永泰铜材加工厂", "永泰铜材", "韩经理", "13901001021", "C", "款到发货"),
        ("台达电子(东莞)有限公司", "台达电子", "唐经理", "13901001022", "A", "月结30天"),
        ("明纬(广州)电子有限公司", "明纬电子", "冯经理", "13901001023", "A", "月结30天"),
        ("华强线束加工厂", "华强线束", "曹经理", "13901001024", "B", "月结15天"),
        ("金奔腾模具加工厂", "金奔腾模具", "邓经理", "13901001025", "B", "月结15天"),
    ]
    objs = []
    for idx, (name, short_name, contact, phone, rating, terms) in enumerate(suppliers_def, start=1):
        code = f"S{idx:03d}"
        s = Supplier(
            code=code,
            name=name,
            short_name=short_name,
            contact_person=contact,
            contact_phone=phone,
            email=f"sales{idx}@{short_name.lower().replace(' ', '')}.com",
            address=f"中国某省某市某区{random.choice(['工业园','科技园','开发区'])}{random.randint(1,99)}号",
            bank_name=random.choice(["中国工商银行", "中国建设银行", "中国银行", "中国农业银行", "招商银行"]),
            bank_account=f"6222{random.randint(10000000,99999999)}{random.randint(1000,9999)}",
            tax_number=f"91110{random.randint(10000000000,99999999999)}",
            payment_terms=terms,
            rating=rating,
            status="active",
            remark=f"主营: {short_name}相关产品",
        )
        db.add(s)
        objs.append(s)
    db.flush()
    # C级供应商数量
    c_count = sum(1 for s in objs if s.rating == "C")
    print(f"   共创建 {len(objs)} 个供应商 (C级 {c_count} 个)。")
    return objs


# ============================================================
# 8. 客户
# ============================================================

def create_customers(db):
    print(">> 创建客户 ...")
    customers_def = [
        ("深圳智控科技有限公司", "深圳智控", "郑经理", "13700100001", "A", Decimal("500000")),
        ("广州博远自动化有限公司", "广州博远", "卢经理", "13700100002", "A", Decimal("800000")),
        ("上海德玛格机械有限公司", "上海德玛格", "毛经理", "13700100003", "A", Decimal("1000000")),
        ("北京华信电气股份有限公司", "北京华信", "邱经理", "13700100004", "A", Decimal("1200000")),
        ("苏州汇川技术有限公司", "苏州汇川", "秦经理", "13700100005", "A", Decimal("1500000")),
        ("杭州海康威视数字技术股份有限公司", "海康威视", "江经理", "13700100006", "A", Decimal("2000000")),
        ("东莞市众志精密机械有限公司", "东莞众志", "方经理", "13700100007", "B", Decimal("300000")),
        ("成都三盛自动化设备有限公司", "成都三盛", "章经理", "13700100008", "B", Decimal("400000")),
        ("武汉博创电气有限公司", "武汉博创", "鲁经理", "13700100009", "B", Decimal("350000")),
        ("南京拓控电子科技有限公司", "南京拓控", "韦经理", "13700100010", "B", Decimal("280000")),
        ("西安航天动力机械厂", "西安航天", "余经理", "13700100011", "B", Decimal("600000")),
        ("青岛海尔智能家电有限公司", "海尔智能", "潘经理", "13700100012", "A", Decimal("1800000")),
        ("厦门宏发电声股份有限公司", "厦门宏发", "贝经理", "13700100013", "B", Decimal("450000")),
        ("长沙中联重科股份有限公司", "中联重科", "苗经理", "13700100014", "A", Decimal("900000")),
        ("天津一机机床有限公司", "天津一机", "俞经理", "13700100015", "B", Decimal("320000")),
        ("宁波海天塑机集团有限公司", "海天塑机", "元经理", "13700100016", "B", Decimal("500000")),
        ("佛山顺德科威电子厂", "顺德科威", "鲍经理", "13700100017", "C", Decimal("150000")),
        ("合肥美的电冰箱有限公司", "美的冰箱", "费经理", "13700100018", "A", Decimal("1100000")),
        ("重庆长征重工有限责任公司", "重庆长征", "岑经理", "13700100019", "B", Decimal("420000")),
        ("沈阳机床股份有限公司", "沈阳机床", "倪经理", "13700100020", "B", Decimal("380000")),
    ]
    objs = []
    for idx, (name, short_name, contact, phone, rating, credit) in enumerate(customers_def, start=1):
        code = f"C{idx:03d}"
        c = Customer(
            code=code,
            name=name,
            short_name=short_name,
            contact_person=contact,
            contact_phone=phone,
            email=f"purchase{idx}@{short_name}.com",
            address=f"中国某省某市某区{random.choice(['工业园','科技园','开发区','商务中心'])}{random.randint(1,99)}号",
            bank_name=random.choice(["中国工商银行", "中国建设银行", "中国银行", "中国农业银行", "招商银行"]),
            bank_account=f"6228{random.randint(10000000,99999999)}{random.randint(1000,9999)}",
            tax_number=f"91330{random.randint(10000000000,99999999999)}",
            credit_limit=credit,
            payment_terms=random.choice(["月结30天", "月结45天", "月结60天"]),
            status="active",
            remark=f"评级:{rating}",
        )
        db.add(c)
        objs.append(c)
    db.flush()
    print(f"   共创建 {len(objs)} 个客户。")
    return objs


# ============================================================
# 9. BOM
# ============================================================

def create_boms(db, materials):
    print(">> 创建BOM ...")
    raws, semis, fgs = group_materials(materials)
    count = 0
    for fg in fgs:
        # 每个成品使用 3~6 个子物料（来自原材料或半成品）
        num_children = random.randint(3, 6)
        pool = raws + semis
        children = pick_sample(pool, min(num_children, len(pool)))
        for child in children:
            qty = Decimal(random.randint(1, 10))
            b = BOM(
                parent_material_id=fg.id,
                child_material_id=child.id,
                quantity=qty,
                unit=child.unit,
                remark="",
            )
            db.add(b)
            count += 1
    # 半成品也使用一些原材料
    for sf in semis:
        num_children = random.randint(2, 4)
        children = pick_sample(raws, min(num_children, len(raws)))
        for child in children:
            qty = Decimal(random.randint(1, 5))
            b = BOM(
                parent_material_id=sf.id,
                child_material_id=child.id,
                quantity=qty,
                unit=child.unit,
                remark="",
            )
            db.add(b)
            count += 1
    db.flush()
    print(f"   共创建 {count} 条BOM。")


# ============================================================
# 10. 初始库存
# ============================================================

def create_inventory(db, materials, wh_map):
    print(">> 创建初始库存 ...")
    raws, semis, fgs = group_materials(materials)
    inventory_map = {}  # (material_id, warehouse_id) -> inventory

    def _add_inv(material, wh, min_mult=1.0, max_mult=3.0, low_stock_ratio=0.1):
        """创建库存，约 low_stock_ratio 比例低于安全库存。"""
        safety = material.safety_stock or Decimal("1")
        if random.random() < low_stock_ratio:
            # 低于安全库存（用于告警）
            qty = safety * Decimal(str(round(random.uniform(0.1, 0.9), 2)))
        else:
            qty = safety * Decimal(str(round(random.uniform(min_mult, max_mult), 2)))
        qty = money(qty, 4)
        avg_cost = material.standard_cost or Decimal("0")
        inv = Inventory(
            material_id=material.id,
            warehouse_id=wh.id,
            quantity=qty,
            locked_quantity=Decimal("0"),
            average_cost=avg_cost,
            last_in_date=rand_datetime(SIX_MONTHS_AGO, THREE_MONTHS_AGO),
            last_out_date=rand_datetime(THREE_MONTHS_AGO, TODAY),
        )
        db.add(inv)
        db.flush()
        inventory_map[(material.id, wh.id)] = inv

    w01 = wh_map["W01"]
    w02 = wh_map["W02"]
    w03 = wh_map["W03"]

    for m in raws:
        _add_inv(m, w01)
    for m in semis:
        _add_inv(m, w02)
    for m in fgs:
        _add_inv(m, w03)

    print(f"   共创建 {len(inventory_map)} 条库存记录。")
    return inventory_map


# ============================================================
# 11. 采购订单 + 12. 采购入库
# ============================================================

def create_purchase_orders_and_receipts(db, suppliers, materials, wh_map, user_map, inventory_map):
    print(">> 创建采购订单与入库单 ...")
    raws, semis, _ = group_materials(materials)
    # 采购物料主要为原材料与半成品
    purchasable = raws + semis
    w01 = wh_map["W01"]
    w02 = wh_map["W02"]

    po_count = 0
    receipt_count = 0
    # 用于生成应付
    audited_receipts = []

    buyers = [user_map["zhangming"], user_map["lili"]]
    auditor_ids = [user_map["admin"].id]

    for i in range(1, 201):
        supplier = pick(suppliers)
        bill_date = rand_date(SIX_MONTHS_AGO, TODAY - timedelta(days=5))
        po_no = f"PO2026{bill_date.strftime('%m%d')}{i:04d}"

        # 每张订单 1~5 个明细
        num_items = random.randint(1, 5)
        chosen = pick_sample(purchasable, num_items)

        order = PurchaseOrder(
            bill_no=po_no,
            bill_date=bill_date,
            supplier_id=supplier.id,
            department_id=user_map["zhangming"].department_id,
            buyer_id=pick(buyers).id,
            currency="CNY",
            payment_terms=supplier.payment_terms,
            expected_date=bill_date + timedelta(days=random.randint(7, 30)),
            delivery_address="厂区A栋-1F 原料仓",
            status="audited",
            created_by=pick(buyers).id,
            created_at=datetime(bill_date.year, bill_date.month, bill_date.day, 9, 0),
            audited_by=pick(auditor_ids),
            audited_at=datetime(bill_date.year, bill_date.month, bill_date.day, 14, 0),
        )
        db.add(order)
        db.flush()

        total_amt = Decimal("0")
        total_tax = Decimal("0")
        total_with_tax = Decimal("0")

        for mat in chosen:
            qty = Decimal(random.randint(50, 2000))
            unit_price = mat.standard_price or Decimal("1")
            # 随机波动价格 ±5%
            unit_price = money(unit_price * Decimal(str(round(random.uniform(0.95, 1.05), 4))), 4)
            tax_rate = mat.tax_rate or Decimal("0.13")
            amount = money(qty * unit_price)
            tax_amount = money(amount * tax_rate)
            tot = money(amount + tax_amount)
            item = PurchaseOrderItem(
                order_id=order.id,
                material_id=mat.id,
                quantity=qty,
                unit_price=unit_price,
                tax_rate=tax_rate,
                amount=amount,
                tax_amount=tax_amount,
                total_amount=tot,
                received_quantity=Decimal("0"),
            )
            db.add(item)
            total_amt += amount
            total_tax += tax_amount
            total_with_tax += tot

        order.total_amount = money(total_amt)
        order.total_tax = money(total_tax)
        order.total_amount_with_tax = money(total_with_tax)
        po_count += 1

        # 决定订单状态
        r = random.random()
        if r < 0.10:
            # 仅审核未入库
            order.status = "audited"
        elif r < 0.20:
            # 部分入库
            order.status = "partial_receipt"
            _create_receipt_for_order(db, order, wh_map, user_map, bill_date,
                                      fraction=Decimal(str(round(random.uniform(0.3, 0.7), 2))),
                                      audited_receipts=audited_receipts,
                                      inventory_map=inventory_map,
                                      inspect_status="qualified")
            receipt_count += 1
        elif r < 0.85:
            # 全部入库
            order.status = "receipted"
            _create_receipt_for_order(db, order, wh_map, user_map, bill_date,
                                      fraction=Decimal("1.0"),
                                      audited_receipts=audited_receipts,
                                      inventory_map=inventory_map,
                                      inspect_status="qualified")
            receipt_count += 1
        else:
            # 已关闭（可能全额入库后关闭）
            order.status = "closed"
            _create_receipt_for_order(db, order, wh_map, user_map, bill_date,
                                      fraction=Decimal("1.0"),
                                      audited_receipts=audited_receipts,
                                      inventory_map=inventory_map,
                                      inspect_status="qualified")
            receipt_count += 1

    db.flush()
    print(f"   共创建 {po_count} 张采购订单, {receipt_count} 张入库单。")
    return audited_receipts


def _create_receipt_for_order(db, order, wh_map, user_map, bill_date,
                              fraction, audited_receipts, inventory_map,
                              inspect_status="qualified"):
    """为采购订单创建入库单。fraction = 入库比例。"""
    receipt_date = bill_date + timedelta(days=random.randint(3, 20))
    if receipt_date > TODAY:
        receipt_date = TODAY
    receipt_no = f"PR{order.bill_no[2:]}"  # 用PO的编号衍生
    warehouse_id = wh_map["W01"].id  # 默认W01

    receipt = PurchaseReceipt(
        bill_no=receipt_no,
        bill_date=receipt_date,
        supplier_id=order.supplier_id,
        order_id=order.id,
        order_no=order.bill_no,
        warehouse_id=warehouse_id,
        receiver_id=user_map["wangqiang"].id,
        total_quantity=Decimal("0"),
        total_amount=Decimal("0"),
        inspect_status=inspect_status,
        status="audited",
        created_by=user_map["wangqiang"].id,
        created_at=datetime(receipt_date.year, receipt_date.month, receipt_date.day, 10, 0),
        audited_by=user_map["admin"].id,
        audited_at=datetime(receipt_date.year, receipt_date.month, receipt_date.day, 15, 0),
    )
    db.add(receipt)
    db.flush()

    total_qty = Decimal("0")
    total_amt = Decimal("0")

    for item in order.items:
        recv_qty = money(item.quantity * fraction, 4)
        if recv_qty <= 0:
            continue
        # 确定仓库：半成品入W02
        mat = item.material
        if mat.material_type == "semi":
            wh_id = wh_map["W02"].id
        else:
            wh_id = wh_map["W01"].id
        qualified_qty = recv_qty
        unit_price = item.unit_price
        amt = money(recv_qty * unit_price)
        ri = PurchaseReceiptItem(
            receipt_id=receipt.id,
            material_id=mat.id,
            order_item_id=item.id,
            order_quantity=item.quantity,
            received_quantity=recv_qty,
            qualified_quantity=qualified_qty,
            unit_price=unit_price,
            amount=amt,
            batch_no=f"BAT{receipt_date.strftime('%Y%m%d')}{random.randint(100,999)}",
        )
        db.add(ri)
        total_qty += recv_qty
        total_amt += amt

        # 累加到订单明细的已入库数量
        item.received_quantity = (item.received_quantity or Decimal("0")) + recv_qty

        # 更新库存
        key = (mat.id, wh_id)
        inv = inventory_map.get(key)
        if inv is None:
            inv = Inventory(
                material_id=mat.id,
                warehouse_id=wh_id,
                quantity=Decimal("0"),
                locked_quantity=Decimal("0"),
                average_cost=mat.standard_cost or Decimal("0"),
            )
            db.add(inv)
            db.flush()
            inventory_map[key] = inv
        # 移动加权平均
        old_qty = inv.quantity or Decimal("0")
        old_cost = inv.average_cost or Decimal("0")
        new_qty = old_qty + recv_qty
        if new_qty > 0:
            new_cost = (old_qty * old_cost + recv_qty * unit_price) / new_qty
            inv.average_cost = money(new_cost, 4)
        inv.quantity = new_qty
        inv.last_in_date = datetime(receipt_date.year, receipt_date.month, receipt_date.day, 10, 0)

        # 记录库存流水
        sm = StockMovement(
            material_id=mat.id,
            warehouse_id=wh_id,
            movement_type="in",
            source_type="purchase_receipt",
            source_bill_no=receipt_no,
            quantity=recv_qty,
            unit_cost=unit_price,
            balance_quantity=new_qty,
            movement_date=datetime(receipt_date.year, receipt_date.month, receipt_date.day, 10, 0),
            remark=f"采购入库 {receipt_no}",
        )
        db.add(sm)

    receipt.total_quantity = money(total_qty, 4)
    receipt.total_amount = money(total_amt)
    # 修正warehouse_id为实际使用的仓库（取第一个明细的仓库）
    receipt.warehouse_id = warehouse_id
    db.flush()

    audited_receipts.append(receipt)


# ============================================================
# 13. 销售订单 + 14. 销售出库
# ============================================================

def create_sales_orders_and_deliveries(db, customers, materials, wh_map, user_map):
    print(">> 创建销售订单与出库单 ...")
    _, _, fgs = group_materials(materials)
    w03 = wh_map["W03"]
    salesperson = user_map["sunwei"]
    auditor_ids = [user_map["admin"].id]

    so_count = 0
    delivery_count = 0
    audited_deliveries = []

    for i in range(1, 151):
        customer = pick(customers)
        bill_date = rand_date(SIX_MONTHS_AGO, TODAY - timedelta(days=3))
        so_no = f"SO2026{bill_date.strftime('%m%d')}{i:04d}"

        num_items = random.randint(1, 4)
        chosen = pick_sample(fgs, num_items)

        order = SalesOrder(
            bill_no=so_no,
            bill_date=bill_date,
            customer_id=customer.id,
            salesperson_id=salesperson.id,
            currency="CNY",
            payment_terms=customer.payment_terms,
            expected_delivery_date=bill_date + timedelta(days=random.randint(7, 30)),
            delivery_address=customer.address,
            status="audited",
            created_by=salesperson.id,
            created_at=datetime(bill_date.year, bill_date.month, bill_date.day, 9, 0),
            audited_by=pick(auditor_ids),
            audited_at=datetime(bill_date.year, bill_date.month, bill_date.day, 14, 0),
        )
        db.add(order)
        db.flush()

        total_amt = Decimal("0")
        total_tax = Decimal("0")
        total_with_tax = Decimal("0")

        for mat in chosen:
            qty = Decimal(random.randint(20, 500))
            # 售价 = 标准成本 × (1.2 ~ 1.8)
            unit_price = money((mat.standard_cost or Decimal("1")) * Decimal(str(round(random.uniform(1.2, 1.8), 2))), 4)
            tax_rate = mat.tax_rate or Decimal("0.13")
            amount = money(qty * unit_price)
            tax_amount = money(amount * tax_rate)
            tot = money(amount + tax_amount)
            item = SalesOrderItem(
                order_id=order.id,
                material_id=mat.id,
                quantity=qty,
                unit_price=unit_price,
                tax_rate=tax_rate,
                amount=amount,
                tax_amount=tax_amount,
                total_amount=tot,
                delivered_quantity=Decimal("0"),
            )
            db.add(item)
            total_amt += amount
            total_tax += tax_amount
            total_with_tax += tot

        order.total_amount = money(total_amt)
        order.total_tax = money(total_tax)
        order.total_amount_with_tax = money(total_with_tax)
        so_count += 1

        r = random.random()
        if r < 0.10:
            order.status = "audited"
        elif r < 0.25:
            order.status = "partial_delivery"
            _create_delivery_for_order(db, order, wh_map, user_map, bill_date,
                                        fraction=Decimal(str(round(random.uniform(0.3, 0.7), 2))),
                                        audited_deliveries=audited_deliveries)
            delivery_count += 1
        elif r < 0.90:
            order.status = "delivered"
            _create_delivery_for_order(db, order, wh_map, user_map, bill_date,
                                        fraction=Decimal("1.0"),
                                        audited_deliveries=audited_deliveries)
            delivery_count += 1
        else:
            order.status = "closed"
            _create_delivery_for_order(db, order, wh_map, user_map, bill_date,
                                        fraction=Decimal("1.0"),
                                        audited_deliveries=audited_deliveries)
            delivery_count += 1

    db.flush()
    print(f"   共创建 {so_count} 张销售订单, {delivery_count} 张出库单。")
    return audited_deliveries


def _create_delivery_for_order(db, order, wh_map, user_map, bill_date,
                                fraction, audited_deliveries):
    delivery_date = bill_date + timedelta(days=random.randint(3, 20))
    if delivery_date > TODAY:
        delivery_date = TODAY
    delivery_no = f"SD{order.bill_no[2:]}"
    w03 = wh_map["W03"]

    delivery = SalesDelivery(
        bill_no=delivery_no,
        bill_date=delivery_date,
        customer_id=order.customer_id,
        order_id=order.id,
        order_no=order.bill_no,
        warehouse_id=w03.id,
        total_quantity=Decimal("0"),
        total_amount=Decimal("0"),
        status="audited",
        created_by=user_map["wangqiang"].id,
        created_at=datetime(delivery_date.year, delivery_date.month, delivery_date.day, 10, 0),
        audited_by=user_map["admin"].id,
        audited_at=datetime(delivery_date.year, delivery_date.month, delivery_date.day, 15, 0),
    )
    db.add(delivery)
    db.flush()

    total_qty = Decimal("0")
    total_amt = Decimal("0")

    for item in order.items:
        deliv_qty = money(item.quantity * fraction, 4)
        if deliv_qty <= 0:
            continue
        mat = item.material
        unit_price = item.unit_price
        amt = money(deliv_qty * unit_price)
        di = SalesDeliveryItem(
            delivery_id=delivery.id,
            material_id=mat.id,
            order_item_id=item.id,
            order_quantity=item.quantity,
            delivered_quantity=deliv_qty,
            unit_price=unit_price,
            amount=amt,
        )
        db.add(di)
        total_qty += deliv_qty
        total_amt += amt

        item.delivered_quantity = (item.delivered_quantity or Decimal("0")) + deliv_qty

        # 扣减库存
        key = (mat.id, w03.id)
        inv = db.query(Inventory).filter_by(material_id=mat.id, warehouse_id=w03.id).first()
        if inv is None:
            inv = Inventory(
                material_id=mat.id,
                warehouse_id=w03.id,
                quantity=Decimal("0"),
                locked_quantity=Decimal("0"),
                average_cost=mat.standard_cost or Decimal("0"),
            )
            db.add(inv)
            db.flush()
        old_qty = inv.quantity or Decimal("0")
        new_qty = old_qty - deliv_qty
        inv.quantity = new_qty
        inv.last_out_date = datetime(delivery_date.year, delivery_date.month, delivery_date.day, 10, 0)

        sm = StockMovement(
            material_id=mat.id,
            warehouse_id=w03.id,
            movement_type="out",
            source_type="sales_delivery",
            source_bill_no=delivery_no,
            quantity=-deliv_qty,
            unit_cost=inv.average_cost or Decimal("0"),
            balance_quantity=new_qty,
            movement_date=datetime(delivery_date.year, delivery_date.month, delivery_date.day, 10, 0),
            remark=f"销售出库 {delivery_no}",
        )
        db.add(sm)

    delivery.total_quantity = money(total_qty, 4)
    delivery.total_amount = money(total_amt)
    db.flush()
    audited_deliveries.append(delivery)


# ============================================================
# 15. 应付账款 + 17. 付款
# ============================================================

def create_payables_and_payments(db, audited_receipts, suppliers, user_map):
    print(">> 创建应付账款与付款单 ...")
    payable_count = 0
    all_payables = []
    for receipt in audited_receipts:
        # 供应商
        supplier = receipt.supplier
        amount = receipt.total_amount or Decimal("0")
        if amount <= 0:
            continue
        bill_date = receipt.bill_date
        due_date = bill_date + timedelta(days=30)
        p = Payable(
            supplier_id=receipt.supplier_id,
            bill_type="purchase_receipt",
            bill_no=receipt.bill_no,
            bill_date=bill_date,
            amount=money(amount),
            paid_amount=Decimal("0"),
            balance=money(amount),
            status="unpaid",
            due_date=due_date,
            remark="",
        )
        db.add(p)
        all_payables.append(p)
        payable_count += 1
    db.flush()
    print(f"   共创建 {payable_count} 条应付账款。")

    # 付款：约 50 张，部分核销应付
    payment_count = 0
    auditor = user_map["admin"].id
    finance_user = user_map["zhaoxin"].id

    # 按供应商分组
    supplier_payables = {}
    for p in all_payables:
        supplier_payables.setdefault(p.supplier_id, []).append(p)

    for i in range(1, 51):
        # 随机选一个供应商，有未付余额的
        eligible = [s for s in suppliers if s.id in supplier_payables]
        if not eligible:
            break
        supplier = pick(eligible)
        plist = supplier_payables.get(supplier.id, [])
        unpaid = [p for p in plist if p.balance and p.balance > 0]
        if not unpaid:
            continue
        # 选 1~3 条核销
        chosen = pick_sample(unpaid, min(random.randint(1, 3), len(unpaid)))
        bill_date = rand_date(SIX_MONTHS_AGO, TODAY)
        pay_no = f"PAY2026{bill_date.strftime('%m%d')}{i:04d}"

        total_pay = Decimal("0")
        items_to_add = []
        for p in chosen:
            # 部分或全部付款
            this_pay = money(p.balance * Decimal(str(round(random.uniform(0.3, 1.0), 2))))
            if this_pay <= 0:
                continue
            this_pay = min(this_pay, p.balance)
            items_to_add.append((p, this_pay))
            total_pay += this_pay

        if not items_to_add or total_pay <= 0:
            continue

        payment = Payment(
            bill_no=pay_no,
            bill_date=bill_date,
            supplier_id=supplier.id,
            payment_method=random.choice(["bank", "bank", "cash"]),
            bank_account=f"6222{random.randint(1000000000,9999999999)}",
            total_amount=money(total_pay),
            status="audited",
            created_by=finance_user,
            created_at=datetime(bill_date.year, bill_date.month, bill_date.day, 9, 0),
            audited_by=auditor,
            audited_at=datetime(bill_date.year, bill_date.month, bill_date.day, 16, 0),
            remark="",
        )
        db.add(payment)
        db.flush()

        for p, this_pay in items_to_add:
            pi = PaymentItem(
                payment_id=payment.id,
                payable_id=p.id,
                payable_bill_no=p.bill_no,
                payable_amount=p.amount,
                this_payment=this_pay,
            )
            db.add(pi)
            p.paid_amount = money((p.paid_amount or Decimal("0")) + this_pay)
            p.balance = money(p.amount - p.paid_amount)
            if p.balance <= 0:
                p.status = "paid"
            else:
                p.status = "partial"
        payment_count += 1
    db.flush()
    print(f"   共创建 {payment_count} 张付款单。")


# ============================================================
# 16. 应收账款 + 18. 收款
# ============================================================

def create_receivables_and_receipts(db, audited_deliveries, customers, user_map):
    print(">> 创建应收账款与收款单 ...")
    rec_count = 0
    all_receivables = []
    for delivery in audited_deliveries:
        amount = delivery.total_amount or Decimal("0")
        if amount <= 0:
            continue
        bill_date = delivery.bill_date
        due_date = bill_date + timedelta(days=30)
        r = Receivable(
            customer_id=delivery.customer_id,
            bill_type="sales_delivery",
            bill_no=delivery.bill_no,
            bill_date=bill_date,
            amount=money(amount),
            received_amount=Decimal("0"),
            balance=money(amount),
            status="unpaid",
            due_date=due_date,
            remark="",
        )
        db.add(r)
        all_receivables.append(r)
        rec_count += 1
    db.flush()
    print(f"   共创建 {rec_count} 条应收账款。")

    # 收款：约 40 张
    receipt_count = 0
    auditor = user_map["admin"].id
    finance_user = user_map["zhaoxin"].id

    customer_recs = {}
    for r in all_receivables:
        customer_recs.setdefault(r.customer_id, []).append(r)

    for i in range(1, 41):
        eligible = [c for c in customers if c.id in customer_recs]
        if not eligible:
            break
        customer = pick(eligible)
        rlist = customer_recs.get(customer.id, [])
        unpaid = [r for r in rlist if r.balance and r.balance > 0]
        if not unpaid:
            continue
        chosen = pick_sample(unpaid, min(random.randint(1, 3), len(unpaid)))
        bill_date = rand_date(SIX_MONTHS_AGO, TODAY)
        rcv_no = f"RCV2026{bill_date.strftime('%m%d')}{i:04d}"

        total_rcv = Decimal("0")
        items_to_add = []
        for r in chosen:
            this_rcv = money(r.balance * Decimal(str(round(random.uniform(0.3, 1.0), 2))))
            if this_rcv <= 0:
                continue
            this_rcv = min(this_rcv, r.balance)
            items_to_add.append((r, this_rcv))
            total_rcv += this_rcv

        if not items_to_add or total_rcv <= 0:
            continue

        receipt = Receipt(
            bill_no=rcv_no,
            bill_date=bill_date,
            customer_id=customer.id,
            payment_method=random.choice(["bank", "bank", "cash"]),
            bank_account=f"6228{random.randint(1000000000,9999999999)}",
            total_amount=money(total_rcv),
            status="audited",
            created_by=finance_user,
            created_at=datetime(bill_date.year, bill_date.month, bill_date.day, 9, 0),
            audited_by=auditor,
            audited_at=datetime(bill_date.year, bill_date.month, bill_date.day, 16, 0),
            remark="",
        )
        db.add(receipt)
        db.flush()

        for r, this_rcv in items_to_add:
            ri = ReceiptItem(
                receipt_id=receipt.id,
                receivable_id=r.id,
                receivable_bill_no=r.bill_no,
                receivable_amount=r.amount,
                this_receipt=this_rcv,
            )
            db.add(ri)
            r.received_amount = money((r.received_amount or Decimal("0")) + this_rcv)
            r.balance = money(r.amount - r.received_amount)
            if r.balance <= 0:
                r.status = "paid"
            else:
                r.status = "partial"
        receipt_count += 1
    db.flush()
    print(f"   共创建 {receipt_count} 张收款单。")


# ============================================================
# 19. 学习场景
# ============================================================

def create_learning_scenarios(db):
    print(">> 创建学习场景 ...")
    scenarios = [
        # (code, name, difficulty, role, modules, est_time, background, objectives, constraints, checkpoints)
        ("S01", "新供应商建档与首次采购", 1, "采购员", "供应商档案,采购订单", 30,
         "公司需要引入一家新的钢材供应商，需要完成供应商建档并下达首张采购订单。",
         json.dumps([
             "在系统中新建供应商档案，包含银行账户、税号、付款条件等信息",
             "根据采购申请创建采购订单，选择正确的供应商和物料",
             "提交采购订单并完成审核",
         ], ensure_ascii=False),
         json.dumps([
             "供应商编码符合规范",
             "付款条件与合同一致",
             "采购订单金额计算正确（含税）",
         ], ensure_ascii=False),
         json.dumps([
             {"check": "供应商档案完整", "score": 30},
             {"check": "采购订单物料选择正确", "score": 30},
             {"check": "订单审核通过", "score": 20},
             {"check": "金额计算无误", "score": 20},
         ], ensure_ascii=False)),
        ("S02", "采购入库与质检", 1, "仓管员", "采购入库", 25,
         "供应商发货到货，仓管员需要完成收货、质检并办理入库。",
         json.dumps([
             "根据采购订单创建入库单",
             "录入实收数量和合格数量",
             "审核入库单，系统自动更新库存",
         ], ensure_ascii=False),
         json.dumps([
             "实收数量不得超过订单数量",
             "合格数量不得超过实收数量",
             "入库单审核后库存自动增加",
         ], ensure_ascii=False),
         json.dumps([
             {"check": "入库单关联采购订单", "score": 30},
             {"check": "数量录入正确", "score": 30},
             {"check": "库存更新成功", "score": 25},
             {"check": "生成库存流水", "score": 15},
         ], ensure_ascii=False)),
        ("S03", "采购退货处理", 2, "采购员", "采购退货", 30,
         "质检发现一批原材料不合格，需要办理退货给供应商。",
         json.dumps([
             "创建采购退货单，关联原入库单",
             "录入退货数量与退货原因",
             "审核退货单，系统自动扣减库存并生成红字应付",
         ], ensure_ascii=False),
         json.dumps([
             "退货数量不得超过已入库数量",
             "退货原因必须填写",
             "审核后库存自动扣减",
         ], ensure_ascii=False),
         json.dumps([
             {"check": "退货单关联入库单", "score": 30},
             {"check": "退货数量合理", "score": 25},
             {"check": "库存扣减正确", "score": 25},
             {"check": "应付账款调整", "score": 20},
         ], ensure_ascii=False)),
        ("S04", "销售订单与出库", 1, "销售员", "销售订单,销售出库", 25,
         "客户下达采购需求，需要创建销售订单并完成发货出库。",
         json.dumps([
             "创建销售订单，选择客户与产品",
             "提交并审核销售订单",
             "创建销售出库单，扣减成品库存",
         ], ensure_ascii=False),
         json.dumps([
             "出库数量不得超过订单数量",
             "出库单审核后库存自动扣减",
             "出库后自动生成应收账款",
         ], ensure_ascii=False),
         json.dumps([
             {"check": "销售订单创建正确", "score": 25},
             {"check": "出库单关联销售订单", "score": 25},
             {"check": "库存扣减成功", "score": 25},
             {"check": "应收账款生成", "score": 25},
         ], ensure_ascii=False)),
        ("S05", "应付账款付款", 2, "财务员", "付款管理", 30,
         "供应商到期账款需要安排付款，财务进行核销处理。",
         json.dumps([
             "查询供应商未付应付账款",
             "创建付款单，选择核销的应付记录",
             "审核付款单，系统更新应付余额",
         ], ensure_ascii=False),
         json.dumps([
             "付款金额不得超过应付余额",
             "付款单审核后应付状态更新",
             "支持部分付款",
         ], ensure_ascii=False),
         json.dumps([
             {"check": "付款单关联应付", "score": 30},
             {"check": "核销金额正确", "score": 30},
             {"check": "应付余额更新", "score": 25},
             {"check": "付款状态正确", "score": 15},
         ], ensure_ascii=False)),
        ("S06", "应收账款收款", 2, "财务员", "收款管理", 30,
         "客户回款到账，财务进行收款核销处理。",
         json.dumps([
             "查询客户未收应收账款",
             "创建收款单，选择核销的应收记录",
             "审核收款单，系统更新应收余额",
         ], ensure_ascii=False),
         json.dumps([
             "收款金额不得超过应收余额",
             "收款单审核后应收状态更新",
             "支持部分收款",
         ], ensure_ascii=False),
         json.dumps([
             {"check": "收款单关联应收", "score": 30},
             {"check": "核销金额正确", "score": 30},
             {"check": "应收余额更新", "score": 25},
             {"check": "收款状态正确", "score": 15},
         ], ensure_ascii=False)),
        ("S07", "库存盘点", 2, "仓管员", "库存管理,盘点", 35,
         "月底仓库进行实物盘点，发现账实不符，需要录入盘点单并调整库存。",
         json.dumps([
             "创建盘点单，选择仓库",
             "录入实盘数量",
             "审核盘点单，系统自动调整库存差异",
         ], ensure_ascii=False),
         json.dumps([
             "盘点数量必须为非负数",
             "盘点审核后生成盘盈/盘亏流水",
             "盘点期间不允许出入库操作",
         ], ensure_ascii=False),
         json.dumps([
             {"check": "盘点单创建正确", "score": 25},
             {"check": "实盘数量录入", "score": 25},
             {"check": "库存差异调整", "score": 30},
             {"check": "生成库存流水", "score": 20},
         ], ensure_ascii=False)),
        ("S08", "BOM维护与成本核算", 3, "生产管理员", "BOM,成本管理", 40,
         "新增一款成品，需要维护其BOM结构并核算标准成本。",
         json.dumps([
             "创建新成品物料档案",
             "维护BOM结构，添加子物料及用量",
             "系统根据BOM自动核算成品标准成本",
         ], ensure_ascii=False),
         json.dumps([
             "BOM用量必须大于0",
             "标准成本 = Σ(子物料标准成本 × 用量)",
             "BOM不允许循环引用",
         ], ensure_ascii=False),
         json.dumps([
             {"check": "BOM结构正确", "score": 30},
             {"check": "用量录入无误", "score": 25},
             {"check": "成本核算正确", "score": 30},
             {"check": "无循环引用", "score": 15},
         ], ensure_ascii=False)),
        ("S09", "低库存预警与补货", 2, "采购员", "库存管理,采购申请", 30,
         "系统提示部分原材料低于安全库存，采购员需要及时补货。",
         json.dumps([
             "查询低于安全库存的物料",
             "创建采购申请单",
             "将采购申请转为采购订单",
         ], ensure_ascii=False),
         json.dumps([
             "采购数量应满足安全库存要求",
             "采购申请需关联低于安全库存的物料",
         ], ensure_ascii=False),
         json.dumps([
             {"check": "识别低库存物料", "score": 30},
             {"check": "采购申请创建", "score": 30},
             {"check": "转为采购订单", "score": 25},
             {"check": "补货数量合理", "score": 15},
         ], ensure_ascii=False)),
        ("S10", "全流程：采购到付款", 3, "综合", "采购,入库,财务", 60,
         "从采购申请到最终付款的完整流程演练。",
         json.dumps([
             "创建采购申请并审核",
             "根据申请创建采购订单并审核",
             "收货入库并审核",
             "生成应付账款",
             "创建付款单并核销",
         ], ensure_ascii=False),
         json.dumps([
             "各环节单据必须关联",
             "金额在流转过程中保持一致",
             "库存与应付账款同步更新",
         ], ensure_ascii=False),
         json.dumps([
             {"check": "采购申请完整", "score": 15},
             {"check": "采购订单正确", "score": 20},
             {"check": "入库单正确", "score": 20},
             {"check": "应付账款生成", "score": 20},
             {"check": "付款核销完成", "score": 25},
         ], ensure_ascii=False)),
    ]
    for s in scenarios:
        (code, name, diff, role, modules, est_time,
         bg, obj, cons, chk) = s
        ls = LearningScenario(
            code=code,
            name=name,
            difficulty=diff,
            background=bg,
            role=role,
            objectives=obj,
            constraints=cons,
            checkpoints=chk,
            modules=modules,
            estimated_time=est_time,
            status="active",
        )
        db.add(ls)
    db.flush()
    print(f"   共创建 {len(scenarios)} 个学习场景。")


# ============================================================
# 20. 学习进度
# ============================================================

def create_learning_progress(db, user_map):
    print(">> 创建学习课程进度 ...")
    courses = [
        ("tour_01", "ERP入门导览"),
        ("tour_02", "物料档案管理"),
        ("tour_03", "供应商与客户管理"),
        ("tour_04", "采购申请与采购订单"),
        ("tour_05", "采购入库与退货"),
        ("tour_06", "销售订单与出库"),
        ("tour_07", "库存管理与盘点"),
        ("tour_08", "BOM与成本核算"),
        ("tour_09", "应付账款与付款"),
        ("tour_10", "应收账款与收款"),
        ("tour_11", "财务报表分析"),
        ("tour_12", "综合实战演练"),
    ]
    admin = user_map["admin"]
    count = 0
    for cid, cname in courses:
        lp = LearningProgress(
            user_id=admin.id,
            course_id=cid,
            course_name=cname,
            status="not_started",
            progress=0,
        )
        db.add(lp)
        count += 1
    db.flush()
    print(f"   共创建 {count} 条学习进度记录。")


# ============================================================
# 主流程
# ============================================================

def main():
    print("=" * 60)
    print("  知雀ERP 种子数据生成器")
    print("=" * 60)

    # 建表（如果不存在）
    print(">> 检查/创建数据库表 ...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # 1. 清空数据
        clear_data(db)

        # 2. 部门
        dept_map = create_departments(db)

        # 3. 用户
        user_map = create_users(db, dept_map)

        # 4. 仓库
        wh_map = create_warehouses(db, user_map)

        # 5. 物料分类
        cat_map = create_categories(db)

        # 6. 物料
        materials = create_materials(db, cat_map)

        # 7. 供应商
        suppliers = create_suppliers(db)

        # 8. 客户
        customers = create_customers(db)

        # 9. BOM
        create_boms(db, materials)

        # 10. 初始库存
        inventory_map = create_inventory(db, materials, wh_map)

        # 11 & 12. 采购订单与入库
        audited_receipts = create_purchase_orders_and_receipts(
            db, suppliers, materials, wh_map, user_map, inventory_map
        )

        # 13 & 14. 销售订单与出库
        audited_deliveries = create_sales_orders_and_deliveries(
            db, customers, materials, wh_map, user_map
        )

        # 15 & 17. 应付与付款
        create_payables_and_payments(db, audited_receipts, suppliers, user_map)

        # 16 & 18. 应收与收款
        create_receivables_and_receipts(db, audited_deliveries, customers, user_map)

        # 19. 学习场景
        create_learning_scenarios(db)

        # 20. 学习进度
        create_learning_progress(db, user_map)

        db.commit()
        print("=" * 60)
        print("  种子数据生成完成！")
        print("=" * 60)
    except Exception as e:
        db.rollback()
        print(f"[ERROR] 生成失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()

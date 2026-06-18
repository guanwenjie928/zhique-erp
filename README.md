# 知雀进销存ERP训练系统

> 为采购岗位入职训练打造的类金蝶风格进销存ERP系统，内置四大学习引擎

## 快速启动

### Windows
```bash
双击 start.bat
```

### Linux/Mac
```bash
cd zhique-erp
./start.sh
```

启动后浏览器访问: http://localhost:5173

### 首次运行（生成模拟数据）
```bash
cd backend
python3 seed/generate_data.py
```

## 系统账号

| 用户名 | 角色 | 说明 |
|--------|------|------|
| admin | 管理员 | 全部权限 |
| zhangming | 采购员 | 张明，采购部 |
| lili | 采购员 | 李丽，采购部 |
| wangqiang | 仓管员 | 王强，仓储部 |
| zhaoxin | 财务员 | 赵欣，财务部 |

## 功能模块

### 采购管理（核心训练模块）
- 采购申请单 → 采购订单 → 采购入库 → 采购退货
- 供应商管理（25家，含A/B/C评级）
- 下推生成、源单关联、审核机制

### 库存管理
- 实时库存查询、库存流水、库存盘点
- 安全库存预警

### 财务管理
- 应付账款 / 付款单
- 应收账款 / 收款单

### 销售管理
- 销售订单 → 销售出库 → 销售退货
- 客户管理

### 学习中心（四大引擎）
1. **分步引导教学** — 12个课程，高亮遮罩+气泡提示
2. **实战场景模拟** — 10个真实业务场景（季度备货、紧急采购等）
3. **操作评分反馈** — 四维度评分（准确/完整/合规/效率）
4. **知识库+术语词典** — 采购流程、ERP概念、26+专业术语

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + Ant Design 5 + Vite |
| 后端 | Python FastAPI + SQLAlchemy |
| 数据库 | SQLite |
| 引导教学 | react-joyride |
| 桌面打包 | Electron (后续支持) |

## 模拟企业

**恒达精密制造有限公司**
- 员工520人，年营收2.3亿
- 80种物料（原材料40+半成品15+成品25）
- 25家供应商，20家客户
- 6个月历史业务数据

## 项目结构
```
zhique-erp/
├── backend/          # Python FastAPI 后端
│   ├── models/       # 36张数据表
│   ├── routers/      # 21个API路由模块
│   ├── seed/         # 模拟数据生成
│   └── main.py       # 入口
├── frontend/         # React 前端
│   └── src/
│       ├── pages/    # 30+页面组件
│       ├── components/ # 通用组件
│       ├── api/      # API封装
│       └── stores/   # 状态管理
├── data/             # SQLite数据库
├── start.bat         # Windows启动
└── start.sh          # Linux/Mac启动
```

## 后续规划

- [ ] Electron打包为Windows安装包 (.exe)
- [ ] 补齐引导课程（当前4个，目标12个）
- [ ] 评分引擎规则完善
- [ ] BOM管理 + MRP计算
- [ ] 采购报表 + ECharts可视化

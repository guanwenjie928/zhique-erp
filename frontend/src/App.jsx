import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'

// 工作台
import Dashboard from './pages/Dashboard'

// 采购管理
import PurchaseRequestList from './pages/purchase/PurchaseRequestList'
import PurchaseRequestDetail from './pages/purchase/PurchaseRequestDetail'
import PurchaseOrderList from './pages/purchase/PurchaseOrderList'
import PurchaseOrderDetail from './pages/purchase/PurchaseOrderDetail'
import PurchaseReceiptList from './pages/purchase/PurchaseReceiptList'
import PurchaseReceiptDetail from './pages/purchase/PurchaseReceiptDetail'
import PurchaseReturnList from './pages/purchase/PurchaseReturnList'
import PurchaseReturnDetail from './pages/purchase/PurchaseReturnDetail'
import SupplierList from './pages/purchase/SupplierList'

// 库存管理
import InventoryList from './pages/inventory/InventoryList'
import InventoryMovements from './pages/inventory/InventoryMovements'
import StocktakingList from './pages/inventory/StocktakingList'

// 财务管理
import PayableList from './pages/finance/PayableList'
import PaymentList from './pages/finance/PaymentList'
import PaymentDetail from './pages/finance/PaymentDetail'
import ReceivableList from './pages/finance/ReceivableList'
import ReceiptList from './pages/finance/ReceiptList'

// 销售管理
import SalesOrderList from './pages/sales/SalesOrderList'
import SalesOrderDetail from './pages/sales/SalesOrderDetail'
import SalesDeliveryList from './pages/sales/SalesDeliveryList'
import CustomerList from './pages/sales/CustomerList'

// 学习中心
import LearningCenter from './pages/learning/LearningCenter'
import GuidedTour from './pages/learning/GuidedTour'
import ScenarioList from './pages/learning/ScenarioList'
import KnowledgeBase from './pages/learning/KnowledgeBase'
import Glossary from './pages/learning/Glossary'
import MyScores from './pages/learning/MyScores'

// 基础设置
import MaterialList from './pages/settings/MaterialList'
import WarehouseList from './pages/settings/WarehouseList'

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        {/* 工作台 */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />

        {/* 采购管理 */}
        <Route path="/purchase/requests" element={<PurchaseRequestList />} />
        <Route path="/purchase/requests/:id" element={<PurchaseRequestDetail />} />
        <Route path="/purchase/requests/new" element={<PurchaseRequestDetail />} />
        <Route path="/purchase/orders" element={<PurchaseOrderList />} />
        <Route path="/purchase/orders/:id" element={<PurchaseOrderDetail />} />
        <Route path="/purchase/orders/new" element={<PurchaseOrderDetail />} />
        <Route path="/purchase/receipts" element={<PurchaseReceiptList />} />
        <Route path="/purchase/receipts/:id" element={<PurchaseReceiptDetail />} />
        <Route path="/purchase/receipts/new" element={<PurchaseReceiptDetail />} />
        <Route path="/purchase/returns" element={<PurchaseReturnList />} />
        <Route path="/purchase/returns/:id" element={<PurchaseReturnDetail />} />
        <Route path="/purchase/returns/new" element={<PurchaseReturnDetail />} />
        <Route path="/purchase/suppliers" element={<SupplierList />} />

        {/* 库存管理 */}
        <Route path="/inventory/list" element={<InventoryList />} />
        <Route path="/inventory/movements" element={<InventoryMovements />} />
        <Route path="/inventory/stocktaking" element={<StocktakingList />} />

        {/* 财务管理 */}
        <Route path="/finance/payables" element={<PayableList />} />
        <Route path="/finance/payments" element={<PaymentList />} />
        <Route path="/finance/payments/:id" element={<PaymentDetail />} />
        <Route path="/finance/payments/new" element={<PaymentDetail />} />
        <Route path="/finance/receivables" element={<ReceivableList />} />
        <Route path="/finance/receipts" element={<ReceiptList />} />

        {/* 销售管理 */}
        <Route path="/sales/orders" element={<SalesOrderList />} />
        <Route path="/sales/orders/:id" element={<SalesOrderDetail />} />
        <Route path="/sales/orders/new" element={<SalesOrderDetail />} />
        <Route path="/sales/deliveries" element={<SalesDeliveryList />} />
        <Route path="/sales/customers" element={<CustomerList />} />

        {/* 学习中心 */}
        <Route path="/learning" element={<LearningCenter />} />
        <Route path="/learning/tour/:courseId" element={<GuidedTour />} />
        <Route path="/learning/scenarios" element={<ScenarioList />} />
        <Route path="/learning/knowledge" element={<KnowledgeBase />} />
        <Route path="/learning/glossary" element={<Glossary />} />
        <Route path="/learning/scores" element={<MyScores />} />

        {/* 基础设置 */}
        <Route path="/settings/materials" element={<MaterialList />} />
        <Route path="/settings/warehouses" element={<WarehouseList />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App

import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// 响应拦截器
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const msg = error.response?.data?.detail || error.message || '请求失败'
    return Promise.reject(new Error(msg))
  },
)

// ============================================================
// 仪表盘
// ============================================================
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getRecentBills: () => api.get('/dashboard/recent-bills'),
}

// ============================================================
// 物料管理
// ============================================================
export const materialApi = {
  list: (params) => api.get('/materials', { params }),
  get: (id) => api.get(`/materials/${id}`),
  create: (data) => api.post('/materials', data),
  update: (id, data) => api.put(`/materials/${id}`, data),
  delete: (id) => api.delete(`/materials/${id}`),
}

// ============================================================
// 供应商管理
// ============================================================
export const supplierApi = {
  list: (params) => api.get('/suppliers', { params }),
  get: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`),
}

// ============================================================
// 客户管理
// ============================================================
export const customerApi = {
  list: (params) => api.get('/customers', { params }),
  get: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
}

// ============================================================
// 仓库
// ============================================================
export const warehouseApi = {
  list: (params) => api.get('/warehouses', { params }),
  get: (id) => api.get(`/warehouses/${id}`),
  create: (data) => api.post('/warehouses', data),
  update: (id, data) => api.put(`/warehouses/${id}`, data),
}

// ============================================================
// 部门 & 用户
// ============================================================
export const departmentApi = {
  list: () => api.get('/departments'),
}
export const userApi = {
  list: () => api.get('/users'),
  login: (data) => api.post('/users/login', data),
}

// ============================================================
// 采购申请单
// ============================================================
export const purchaseRequestApi = {
  list: (params) => api.get('/purchase-requests', { params }),
  get: (id) => api.get(`/purchase-requests/${id}`),
  create: (data) => api.post('/purchase-requests', data),
  update: (id, data) => api.put(`/purchase-requests/${id}`, data),
  delete: (id) => api.delete(`/purchase-requests/${id}`),
  audit: (id) => api.post(`/purchase-requests/${id}/audit`),
  pushDown: (id, data) => api.post(`/purchase-requests/${id}/push-down`, data),
}

// ============================================================
// 采购订单
// ============================================================
export const purchaseOrderApi = {
  list: (params) => api.get('/purchase-orders', { params }),
  get: (id) => api.get(`/purchase-orders/${id}`),
  create: (data) => api.post('/purchase-orders', data),
  update: (id, data) => api.put(`/purchase-orders/${id}`, data),
  delete: (id) => api.delete(`/purchase-orders/${id}`),
  audit: (id) => api.post(`/purchase-orders/${id}/audit`),
  pushDown: (id, data) => api.post(`/purchase-orders/${id}/push-down`, data),
}

// ============================================================
// 采购入库
// ============================================================
export const purchaseReceiptApi = {
  list: (params) => api.get('/purchase-receipts', { params }),
  get: (id) => api.get(`/purchase-receipts/${id}`),
  create: (data) => api.post('/purchase-receipts', data),
  update: (id, data) => api.put(`/purchase-receipts/${id}`, data),
  delete: (id) => api.delete(`/purchase-receipts/${id}`),
  audit: (id) => api.post(`/purchase-receipts/${id}/audit`),
}

// ============================================================
// 采购退货
// ============================================================
export const purchaseReturnApi = {
  list: (params) => api.get('/purchase-returns', { params }),
  get: (id) => api.get(`/purchase-returns/${id}`),
  create: (data) => api.post('/purchase-returns', data),
  update: (id, data) => api.put(`/purchase-returns/${id}`, data),
  delete: (id) => api.delete(`/purchase-returns/${id}`),
  audit: (id) => api.post(`/purchase-returns/${id}/audit`),
}

// ============================================================
// 销售订单
// ============================================================
export const salesOrderApi = {
  list: (params) => api.get('/sales-orders', { params }),
  get: (id) => api.get(`/sales-orders/${id}`),
  create: (data) => api.post('/sales-orders', data),
  update: (id, data) => api.put(`/sales-orders/${id}`, data),
  delete: (id) => api.delete(`/sales-orders/${id}`),
  audit: (id) => api.post(`/sales-orders/${id}/audit`),
}

// ============================================================
// 销售出库
// ============================================================
export const salesDeliveryApi = {
  list: (params) => api.get('/sales-deliveries', { params }),
  get: (id) => api.get(`/sales-deliveries/${id}`),
  create: (data) => api.post('/sales-deliveries', data),
  update: (id, data) => api.put(`/sales-deliveries/${id}`, data),
  delete: (id) => api.delete(`/sales-deliveries/${id}`),
  audit: (id) => api.post(`/sales-deliveries/${id}/audit`),
}

// ============================================================
// 销售退货
// ============================================================
export const salesReturnApi = {
  list: (params) => api.get('/sales-returns', { params }),
  get: (id) => api.get(`/sales-returns/${id}`),
  create: (data) => api.post('/sales-returns', data),
  audit: (id) => api.post(`/sales-returns/${id}/audit`),
}

// ============================================================
// 库存
// ============================================================
export const inventoryApi = {
  list: (params) => api.get('/inventory', { params }),
  movements: (params) => api.get('/inventory/movements', { params }),
  lowStock: () => api.get('/inventory/low-stock'),
}

// ============================================================
// 盘点
// ============================================================
export const stocktakingApi = {
  list: (params) => api.get('/stocktaking', { params }),
  get: (id) => api.get(`/stocktaking/${id}`),
  create: (data) => api.post('/stocktaking', data),
  audit: (id) => api.post(`/stocktaking/${id}/audit`),
}

// ============================================================
// 财务 - 应付/付款
// ============================================================
export const payableApi = {
  list: (params) => api.get('/payables', { params }),
  get: (id) => api.get(`/payables/${id}`),
}
export const paymentApi = {
  list: (params) => api.get('/payments', { params }),
  get: (id) => api.get(`/payments/${id}`),
  create: (data) => api.post('/payments', data),
  audit: (id) => api.post(`/payments/${id}/audit`),
}

// ============================================================
// 财务 - 应收/收款
// ============================================================
export const receivableApi = {
  list: (params) => api.get('/receivables', { params }),
  get: (id) => api.get(`/receivables/${id}`),
}
export const receiptApi = {
  list: (params) => api.get('/receipts', { params }),
  get: (id) => api.get(`/receipts/${id}`),
  create: (data) => api.post('/receipts', data),
  audit: (id) => api.post(`/receipts/${id}/audit`),
}

// ============================================================
// 学习模式
// ============================================================
export const learningApi = {
  getCourses: () => api.get('/learning/courses'),
  getScenarios: () => api.get('/learning/scenarios'),
  getScenario: (code) => api.get(`/learning/scenarios/${code}`),
  startScenario: (code) => api.post(`/learning/scenarios/${code}/start`),
  finishScenario: (code, data) => api.post(`/learning/scenarios/${code}/finish`, data),
  getProgress: () => api.get('/learning/courses'),
  updateProgress: (courseId, data) => api.put(`/learning/courses/${courseId}/progress`, data),
  getScores: () => api.get('/learning/operation-scores'),
  getScoresSummary: () => api.get('/learning/scores/summary'),
  logOperation: (data) => api.post('/learning/operation-logs', data),
}

export default api

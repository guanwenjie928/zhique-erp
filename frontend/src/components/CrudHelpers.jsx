import React from 'react'
import { Modal, message, Form, Input, InputNumber, Select, DatePicker, Button, Space } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

const { confirm } = Modal

/**
 * 通用CRUD列表页HOC
 * 封装了：搜索栏 + 表格 + 新增/编辑弹窗 + 审核确认 + 删除确认
 *
 * 用法：
 * <CrudPage
 *   title="采购订单"
 *   columns={columns}
 *   fetchData={purchaseOrderApi.list}
 *   onCreate={...}
 *   onEdit={...}
 *   ...
 * />
 */
export function useCrudPage({
  fetchData,
  initialSearch = {},
}) {
  const [data, setData] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(20)
  const [search, setSearch] = React.useState(initialSearch)

  const loadData = React.useCallback(async (p = page, ps = pageSize, s = search) => {
    setLoading(true)
    try {
      const res = await fetchData({ skip: (p - 1) * ps, limit: ps, ...s })
      setData(res.items || res)
      setTotal(res.total || (res.items ? res.total : res.length))
    } catch (e) {
      console.error('加载数据失败:', e)
    } finally {
      setLoading(false)
    }
  }, [fetchData, page, pageSize, search])

  React.useEffect(() => {
    loadData()
  }, [page, pageSize])

  const handleSearch = (values) => {
    setSearch(values)
    setPage(1)
    loadData(1, pageSize, values)
  }

  const handleReset = () => {
    setSearch(initialSearch)
    setPage(1)
    loadData(1, pageSize, initialSearch)
  }

  return {
    data, loading, total, page, pageSize, search,
    setPage, setPageSize, handleSearch, handleReset, loadData,
  }
}

/**
 * 确认审核
 */
export function confirmAudit(title, onOk) {
  confirm({
    title: `确认审核「${title}」？`,
    icon: <ExclamationCircleOutlined />,
    content: '审核后单据将生效（影响库存和账务），且不可直接修改。',
    okText: '确认审核',
    cancelText: '取消',
    onOk,
  })
}

/**
 * 确认删除
 */
export function confirmDelete(title, onOk) {
  confirm({
    title: `确认删除「${title}」？`,
    icon: <ExclamationCircleOutlined />,
    content: '只有草稿状态的单据可以删除，删除后不可恢复。',
    okText: '确认删除',
    cancelText: '取消',
    okType: 'danger',
    onOk,
  })
}

/**
 * 格式化金额
 */
export function formatMoney(num) {
  if (num === null || num === undefined) return '-'
  return `¥${Number(num).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * 格式化日期
 */
export function formatDate(date) {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD')
}

/**
 * 格式化日期时间
 */
export function formatDateTime(date) {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

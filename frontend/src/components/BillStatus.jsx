import React from 'react'
import { Tag } from 'antd'

/**
 * 单据状态标签组件
 * 对标金蝶ERP的单据状态显示
 */
const STATUS_CONFIG = {
  // 通用状态
  draft: { text: '草稿', color: 'default' },
  submitted: { text: '已提交', color: 'processing' },
  audited: { text: '已审核', color: 'success' },

  // 采购订单特殊状态
  partial_receipt: { text: '部分入库', color: 'warning' },
  receipted: { text: '已入库', color: 'success' },
  closed: { text: '已关闭', color: 'default' },

  // 采购申请特殊状态
  linked: { text: '已转单', color: 'success' },

  // 销售订单特殊状态
  partial_delivery: { text: '部分出库', color: 'warning' },
  delivered: { text: '已出库', color: 'success' },

  // 财务状态
  unpaid: { text: '未付款', color: 'error' },
  partial: { text: '部分付款', color: 'warning' },
  paid: { text: '已付款', color: 'success' },
  pending: { text: '待检验', color: 'warning' },
  qualified: { text: '合格', color: 'success' },
  unqualified: { text: '不合格', color: 'error' },
}

export default function BillStatus({ status }) {
  const config = STATUS_CONFIG[status] || { text: status, color: 'default' }
  return <Tag color={config.color}>{config.text}</Tag>
}

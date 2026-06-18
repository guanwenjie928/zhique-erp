import React from 'react'
import {
  Card, Table, Button, Space, message,
} from 'antd'
import { EyeOutlined, AuditOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { receiptApi } from '../../api'
import { useCrudPage, confirmAudit, formatMoney, formatDate } from '../../components/CrudHelpers'
import BillStatus from '../../components/BillStatus'

const RECEIPT_METHOD_MAP = {
  bank: '银行转账',
  cash: '现金',
  check: '支票',
}

export default function ReceiptList() {
  const navigate = useNavigate()

  const {
    data, loading, total, page, pageSize,
    setPage, setPageSize, loadData,
  } = useCrudPage({
    fetchData: receiptApi.list,
    initialSearch: {},
  })

  const handleAudit = (record) => {
    confirmAudit(record.bill_no, async () => {
      try {
        await receiptApi.audit(record.id)
        message.success('审核成功')
        loadData()
      } catch (e) {
        message.error(e.message || '审核失败')
      }
    })
  }

  const columns = [
    {
      title: '收款单号',
      dataIndex: 'bill_no',
      key: 'bill_no',
      width: 180,
    },
    {
      title: '收款日期',
      dataIndex: 'bill_date',
      key: 'bill_date',
      width: 120,
      render: (v) => formatDate(v),
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 180,
    },
    {
      title: '收款方式',
      dataIndex: 'payment_method',
      key: 'payment_method',
      width: 120,
      render: (v) => RECEIPT_METHOD_MAP[v] || v || '-',
    },
    {
      title: '收款金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 130,
      align: 'right',
      render: (v) => <span style={{ fontWeight: 600 }}>{formatMoney(v)}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <BillStatus status={status} />,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v) => v ? formatDate(v) : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/finance/receipts/${record.id}`)}
          >
            查看
          </Button>
          {record.status === 'submitted' && (
            <Button
              type="link"
              size="small"
              icon={<AuditOutlined />}
              onClick={() => handleAudit(record)}
              className="btn-audit-receipt"
            >
              审核
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card title="收款单列表">
        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            onClick={() => navigate('/finance/receipts/new')}
            className="btn-create-receipt"
          >
            新建收款单
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => loadData()}>刷新</Button>
        </Space>

        <Table
          className="receipt-table"
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条记录`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
        />
      </Card>
    </div>
  )
}

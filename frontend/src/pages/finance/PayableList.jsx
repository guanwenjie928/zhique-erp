import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Input, Select, Space, Form, Row, Col, Statistic,
} from 'antd'
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { payableApi, supplierApi } from '../../api'
import { useCrudPage, formatMoney, formatDate } from '../../components/CrudHelpers'
import BillStatus from '../../components/BillStatus'

export default function PayableList() {
  const navigate = useNavigate()
  const [suppliers, setSuppliers] = useState([])
  const [totalPayable, setTotalPayable] = useState(0)
  const [totalBalance, setTotalBalance] = useState(0)
  const [form] = Form.useForm()

  const {
    data, loading, total, page, pageSize,
    setPage, setPageSize, handleSearch, handleReset, loadData,
  } = useCrudPage({
    fetchData: payableApi.list,
    initialSearch: {},
  })

  useEffect(() => {
    supplierApi.list().then((res) => {
      setSuppliers(res.items || res || [])
    }).catch(console.error)
  }, [])

  // 统计
  useEffect(() => {
    const payableSum = data.reduce((s, item) => s + (Number(item.amount) || 0), 0)
    const balanceSum = data.reduce((s, item) => s + (Number(item.balance) || 0), 0)
    setTotalPayable(payableSum)
    setTotalBalance(balanceSum)
  }, [data])

  const columns = [
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: 180,
    },
    {
      title: '单据编号',
      dataIndex: 'bill_no',
      key: 'bill_no',
      width: 180,
    },
    {
      title: '单据日期',
      dataIndex: 'bill_date',
      key: 'bill_date',
      width: 120,
      render: (v) => formatDate(v),
    },
    {
      title: '应付金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      align: 'right',
      render: (v) => <span style={{ fontWeight: 600 }}>{formatMoney(v)}</span>,
    },
    {
      title: '已付金额',
      dataIndex: 'paid_amount',
      key: 'paid_amount',
      width: 130,
      align: 'right',
      render: (v) => formatMoney(v),
    },
    {
      title: '余额',
      dataIndex: 'balance',
      key: 'balance',
      width: 130,
      align: 'right',
      render: (v) => {
        const num = Number(v) || 0
        return (
          <span style={{ color: num > 0 ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>
            {formatMoney(num)}
          </span>
        )
      },
    },
    {
      title: '到期日',
      dataIndex: 'due_date',
      key: 'due_date',
      width: 120,
      render: (v) => formatDate(v),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <BillStatus status={status} />,
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => navigate('/finance/payments/new', {
            state: {
              supplier_id: record.supplier_id,
              supplier_name: record.supplier_name,
              payable_id: record.id,
              payable_bill_no: record.bill_no,
              payable_amount: record.balance,
            },
          })}
          className="btn-create-payment"
          disabled={record.status === 'paid' || (record.balance || 0) <= 0}
        >
          新建付款单
        </Button>
      ),
    },
  ]

  const onSearch = (values) => {
    const params = {}
    if (values.supplier_id) params.supplier_id = values.supplier_id
    if (values.status) params.status = values.status
    handleSearch(params)
  }

  return (
    <div>
      <Card title="应付账款">
        {/* 统计 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="应付总额"
                value={totalPayable}
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#1677ff' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="待付余额"
                value={totalBalance}
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="单据数"
                value={total}
                suffix="笔"
              />
            </Card>
          </Col>
        </Row>

        {/* 搜索栏 */}
        <Form
          form={form}
          layout="inline"
          onFinish={onSearch}
          style={{ marginBottom: 16 }}
        >
          <Row gutter={16} style={{ width: '100%' }}>
            <Col span={8}>
              <Form.Item name="supplier_id" label="供应商" style={{ marginBottom: 0 }}>
                <Select
                  placeholder="请选择供应商"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  style={{ width: '100%' }}
                  options={suppliers.map((s) => ({
                    label: s.name,
                    value: s.id,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态" style={{ marginBottom: 0 }}>
                <Select
                  placeholder="全部状态"
                  allowClear
                  style={{ width: '100%' }}
                  options={[
                    { label: '未付款', value: 'unpaid' },
                    { label: '部分付款', value: 'partial' },
                    { label: '已付款', value: 'paid' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                  查询
                </Button>
                <Button onClick={() => { form.resetFields(); handleReset() }}>
                  重置
                </Button>
                <Button icon={<ReloadOutlined />} onClick={() => loadData()}>
                  刷新
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>

        <Table
          className="payable-table"
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1300 }}
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

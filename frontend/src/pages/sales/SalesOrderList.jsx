import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Input, Select, Space, Form, Row, Col,
} from 'antd'
import { PlusOutlined, ReloadOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { salesOrderApi, customerApi } from '../../api'
import { useCrudPage, formatMoney, formatDate } from '../../components/CrudHelpers'
import BillStatus from '../../components/BillStatus'

export default function SalesOrderList() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [form] = Form.useForm()

  const {
    data, loading, total, page, pageSize,
    setPage, setPageSize, handleSearch, handleReset, loadData,
  } = useCrudPage({
    fetchData: salesOrderApi.list,
    initialSearch: {},
  })

  useEffect(() => {
    customerApi.list().then((res) => {
      setCustomers(res.items || res || [])
    }).catch(console.error)
  }, [])

  const columns = [
    {
      title: '订单编号',
      dataIndex: 'bill_no',
      key: 'bill_no',
      width: 180,
    },
    {
      title: '订单日期',
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
      title: '销售员',
      dataIndex: 'salesperson',
      key: 'salesperson',
      width: 100,
    },
    {
      title: '含税金额',
      dataIndex: 'total_amount_with_tax',
      key: 'total_amount_with_tax',
      width: 140,
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
      title: '预计交货日期',
      dataIndex: 'expected_delivery_date',
      key: 'expected_delivery_date',
      width: 130,
      render: (v) => formatDate(v),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/sales/orders/${record.id}`)}
        >
          查看
        </Button>
      ),
    },
  ]

  const onSearch = (values) => {
    const params = {}
    if (values.bill_no) params.bill_no = values.bill_no
    if (values.customer_id) params.customer_id = values.customer_id
    if (values.status) params.status = values.status
    handleSearch(params)
  }

  return (
    <div>
      <Card title="销售订单列表">
        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/sales/orders/new')}
            className="btn-create-sales-order"
          >
            新建销售订单
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => loadData()}>刷新</Button>
        </Space>

        {/* 搜索栏 */}
        <Form
          form={form}
          layout="inline"
          onFinish={onSearch}
          style={{ marginBottom: 16 }}
        >
          <Row gutter={16} style={{ width: '100%' }}>
            <Col span={6}>
              <Form.Item name="bill_no" label="订单编号" style={{ marginBottom: 0 }}>
                <Input
                  placeholder="请输入订单编号"
                  allowClear
                  prefix={<SearchOutlined />}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="customer_id" label="客户" style={{ marginBottom: 0 }}>
                <Select
                  placeholder="请选择客户"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  style={{ width: '100%' }}
                  options={customers.map((c) => ({
                    label: c.name,
                    value: c.id,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="status" label="状态" style={{ marginBottom: 0 }}>
                <Select
                  placeholder="全部状态"
                  allowClear
                  style={{ width: '100%' }}
                  options={[
                    { label: '草稿', value: 'draft' },
                    { label: '已提交', value: 'submitted' },
                    { label: '已审核', value: 'audited' },
                    { label: '部分出库', value: 'partial_delivery' },
                    { label: '已出库', value: 'delivered' },
                    { label: '已关闭', value: 'closed' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                  查询
                </Button>
                <Button onClick={() => { form.resetFields(); handleReset() }}>
                  重置
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>

        <Table
          className="sales-order-table"
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

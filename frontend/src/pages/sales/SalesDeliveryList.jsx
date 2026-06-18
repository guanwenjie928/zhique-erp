import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Input, Select, Space, Form, Row, Col,
} from 'antd'
import { ReloadOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { salesDeliveryApi, customerApi, warehouseApi } from '../../api'
import { useCrudPage, formatMoney, formatDate } from '../../components/CrudHelpers'
import BillStatus from '../../components/BillStatus'

export default function SalesDeliveryList() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [form] = Form.useForm()

  const {
    data, loading, total, page, pageSize,
    setPage, setPageSize, handleSearch, handleReset, loadData,
  } = useCrudPage({
    fetchData: salesDeliveryApi.list,
    initialSearch: {},
  })

  useEffect(() => {
    customerApi.list().then((res) => {
      setCustomers(res.items || res || [])
    }).catch(console.error)
    warehouseApi.list().then((res) => {
      setWarehouses(res.items || res || [])
    }).catch(console.error)
  }, [])

  const columns = [
    {
      title: '出库单号',
      dataIndex: 'bill_no',
      key: 'bill_no',
      width: 180,
    },
    {
      title: '出库日期',
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
      title: '源订单号',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 180,
      render: (v) => v || '-',
    },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
      key: 'warehouse_name',
      width: 120,
    },
    {
      title: '总数量',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '总金额',
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
      title: '操作',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/sales/deliveries/${record.id}`)}
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
    if (values.warehouse_id) params.warehouse_id = values.warehouse_id
    if (values.status) params.status = values.status
    handleSearch(params)
  }

  return (
    <div>
      <Card title="销售出库单列表">
        <Space style={{ marginBottom: 16 }}>
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
              <Form.Item name="bill_no" label="出库单号" style={{ marginBottom: 0 }}>
                <Input
                  placeholder="请输入出库单号"
                  allowClear
                  prefix={<SearchOutlined />}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
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
            <Col span={5}>
              <Form.Item name="warehouse_id" label="仓库" style={{ marginBottom: 0 }}>
                <Select
                  placeholder="请选择仓库"
                  allowClear
                  style={{ width: '100%' }}
                  options={warehouses.map((w) => ({
                    label: w.name,
                    value: w.id,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="status" label="状态" style={{ marginBottom: 0 }}>
                <Select
                  placeholder="全部"
                  allowClear
                  style={{ width: '100%' }}
                  options={[
                    { label: '草稿', value: 'draft' },
                    { label: '已提交', value: 'submitted' },
                    { label: '已审核', value: 'audited' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={3}>
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
          className="sales-delivery-table"
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

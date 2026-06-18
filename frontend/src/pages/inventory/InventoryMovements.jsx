import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Input, Select, Space, Form, Row, Col, Tag, DatePicker,
} from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { inventoryApi, warehouseApi } from '../../api'
import { useCrudPage, formatMoney, formatDateTime } from '../../components/CrudHelpers'

const { RangePicker } = DatePicker

export default function InventoryMovements() {
  const [warehouses, setWarehouses] = useState([])
  const [form] = Form.useForm()

  const {
    data, loading, total, page, pageSize,
    setPage, setPageSize, handleSearch, handleReset, loadData,
  } = useCrudPage({
    fetchData: inventoryApi.movements,
    initialSearch: {},
  })

  useEffect(() => {
    warehouseApi.list().then((res) => {
      setWarehouses(res.items || res || [])
    }).catch(console.error)
  }, [])

  const columns = [
    {
      title: '日期',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      defaultSortOrder: 'descend',
      render: (v) => formatDateTime(v),
    },
    {
      title: '物料编码',
      dataIndex: 'material_code',
      key: 'material_code',
      width: 140,
    },
    {
      title: '物料名称',
      dataIndex: 'material_name',
      key: 'material_name',
      width: 180,
    },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
      key: 'warehouse_name',
      width: 120,
    },
    {
      title: '类型',
      dataIndex: 'movement_type',
      key: 'movement_type',
      width: 80,
      render: (type) => {
        if (type === 'in') {
          return <Tag color="green">入库</Tag>
        }
        if (type === 'out') {
          return <Tag color="red">出库</Tag>
        }
        return <Tag>{type}</Tag>
      },
    },
    {
      title: '源单号',
      dataIndex: 'source_bill_no',
      key: 'source_bill_no',
      width: 180,
      render: (v) => v || '-',
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'right',
      render: (qty, record) => {
        const num = Number(qty) || 0
        if (record.movement_type === 'in') {
          return <span style={{ color: '#52c41a' }}>+{num}</span>
        }
        if (record.movement_type === 'out') {
          return <span style={{ color: '#ff4d4f' }}>-{Math.abs(num)}</span>
        }
        return <span>{num}</span>
      },
    },
    {
      title: '单位成本',
      dataIndex: 'unit_cost',
      key: 'unit_cost',
      width: 120,
      align: 'right',
      render: (v) => formatMoney(v),
    },
    {
      title: '结存数量',
      dataIndex: 'balance_quantity',
      key: 'balance_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 200,
      ellipsis: true,
      render: (v) => v || '-',
    },
  ]

  const onSearch = (values) => {
    const params = {}
    if (values.keyword) params.keyword = values.keyword
    if (values.warehouse_id) params.warehouse_id = values.warehouse_id
    if (values.movement_type) params.movement_type = values.movement_type
    if (values.date_range && values.date_range.length === 2) {
      params.start_date = values.date_range[0].format('YYYY-MM-DD')
      params.end_date = values.date_range[1].format('YYYY-MM-DD')
    }
    handleSearch(params)
  }

  return (
    <div>
      <Card title="库存流水">
        {/* 搜索栏 */}
        <Form
          form={form}
          layout="inline"
          onFinish={onSearch}
          style={{ marginBottom: 16 }}
        >
          <Row gutter={16} style={{ width: '100%' }}>
            <Col span={6}>
              <Form.Item name="keyword" label="物料" style={{ marginBottom: 0 }}>
                <Input
                  placeholder="物料编码 / 名称"
                  allowClear
                  prefix={<SearchOutlined />}
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
              <Form.Item name="movement_type" label="类型" style={{ marginBottom: 0 }}>
                <Select
                  placeholder="全部"
                  allowClear
                  style={{ width: '100%' }}
                  options={[
                    { label: '入库', value: 'in' },
                    { label: '出库', value: 'out' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="date_range" label="日期" style={{ marginBottom: 0 }}>
                <RangePicker
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD"
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
          className="inventory-movements-table"
          columns={columns}
          dataSource={data}
          rowKey={(record, index) => record.id || index}
          loading={loading}
          scroll={{ x: 1400 }}
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

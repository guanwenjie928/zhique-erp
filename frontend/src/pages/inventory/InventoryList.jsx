import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Input, Select, Space, Form, Row, Col,
  Statistic, Tooltip, Alert,
} from 'antd'
import { WarningOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { inventoryApi, warehouseApi } from '../../api'
import { useCrudPage, formatMoney } from '../../components/CrudHelpers'

export default function InventoryList() {
  const [warehouses, setWarehouses] = useState([])
  const [totalValue, setTotalValue] = useState(0)
  const [form] = Form.useForm()

  const {
    data, loading, total, page, pageSize,
    setPage, setPageSize, handleSearch, handleReset, loadData,
  } = useCrudPage({
    fetchData: inventoryApi.list,
    initialSearch: {},
  })

  useEffect(() => {
    warehouseApi.list().then((res) => {
      setWarehouses(res.items || res || [])
    }).catch(console.error)
  }, [])

  // 计算总库存价值
  useEffect(() => {
    const value = data.reduce((sum, item) => {
      return sum + (Number(item.quantity) || 0) * (Number(item.average_cost) || 0)
    }, 0)
    setTotalValue(value)
  }, [data])

  const columns = [
    {
      title: '物料编码',
      dataIndex: 'material_code',
      key: 'material_code',
      width: 140,
      fixed: 'left',
    },
    {
      title: '物料名称',
      dataIndex: 'material_name',
      key: 'material_name',
      width: 180,
    },
    {
      title: '规格',
      dataIndex: 'specification',
      key: 'specification',
      width: 120,
    },
    {
      title: '单位',
      dataIndex: 'unit',
      key: 'unit',
      width: 60,
    },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
      key: 'warehouse_name',
      width: 120,
    },
    {
      title: '库存数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'right',
      sorter: (a, b) => a.quantity - b.quantity,
    },
    {
      title: '锁定数量',
      dataIndex: 'locked_quantity',
      key: 'locked_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '可用数量',
      key: 'available_quantity',
      width: 100,
      align: 'right',
      render: (_, record) => {
        const available = (record.quantity || 0) - (record.locked_quantity || 0)
        return <span style={{ color: available < 0 ? '#ff4d4f' : '#1677ff' }}>{available}</span>
      },
    },
    {
      title: '平均成本',
      dataIndex: 'average_cost',
      key: 'average_cost',
      width: 120,
      align: 'right',
      render: (v) => formatMoney(v),
    },
    {
      title: '安全库存',
      dataIndex: 'safety_stock',
      key: 'safety_stock',
      width: 100,
      align: 'right',
    },
    {
      title: '库存价值',
      key: 'value',
      width: 130,
      align: 'right',
      render: (_, record) => {
        const value = (record.quantity || 0) * (record.average_cost || 0)
        return <span style={{ fontWeight: 600 }}>{formatMoney(value)}</span>
      },
    },
    {
      title: '预警',
      key: 'warning',
      width: 60,
      fixed: 'right',
      render: (_, record) => {
        const isLow = (record.quantity || 0) < (record.safety_stock || 0)
        if (isLow) {
          return (
            <Tooltip title={`库存低于安全库存（${record.safety_stock}）`}>
              <WarningOutlined style={{ color: '#fa8c16', fontSize: 16 }} />
            </Tooltip>
          )
        }
        return null
      },
    },
  ]

  const onSearch = (values) => {
    const params = {}
    if (values.keyword) params.keyword = values.keyword
    if (values.warehouse_id) params.warehouse_id = values.warehouse_id
    handleSearch(params)
  }

  return (
    <div>
      <Card title="库存查询" className="inventory-list-page">
        {/* 搜索栏 */}
        <Form
          form={form}
          layout="inline"
          onFinish={onSearch}
          style={{ marginBottom: 16 }}
        >
          <Row gutter={16} style={{ width: '100%' }}>
            <Col span={8}>
              <Form.Item name="keyword" label="物料" style={{ marginBottom: 0 }}>
                <Input
                  placeholder="物料编码 / 名称"
                  allowClear
                  prefix={<SearchOutlined />}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
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

        {/* 库存价值统计 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="当前页库存总价值"
                value={totalValue}
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#1677ff' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="库存记录数"
                value={total}
                suffix="条"
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="低库存预警"
                value={data.filter((item) => (item.quantity || 0) < (item.safety_stock || 0)).length}
                suffix="种"
                valueStyle={{ color: '#fa8c16' }}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Alert
          message="提示"
          description="橙色警告图标表示该物料库存低于安全库存，请及时补货。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Table
          className="inventory-table"
          columns={columns}
          dataSource={data}
          rowKey={(record) => `${record.material_id}-${record.warehouse_id}`}
          loading={loading}
          scroll={{ x: 1400 }}
          rowClassName={(record) => {
            if ((record.quantity || 0) < (record.safety_stock || 0)) {
              return 'low-stock-row'
            }
            return ''
          }}
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

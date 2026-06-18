import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Space, Form, Input, Select, InputNumber, Modal, Tag, message,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined,
} from '@ant-design/icons'
import { materialApi } from '../../api'
import { useCrudPage, confirmDelete, formatMoney } from '../../components/CrudHelpers'
import BillStatus from '../../components/BillStatus'

const MATERIAL_TYPE_MAP = {
  raw: { text: '原材料', color: 'blue' },
  semi: { text: '半成品', color: 'orange' },
  finished: { text: '成品', color: 'green' },
}

export default function MaterialList() {
  const [modalVisible, setModalVisible] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()
  const [searchForm] = Form.useForm()

  const {
    data, loading, total, page, pageSize,
    setPage, setPageSize, handleSearch, handleReset, loadData,
  } = useCrudPage({
    fetchData: materialApi.list,
    initialSearch: {},
  })

  const handleAdd = () => {
    setEditingRecord(null)
    form.resetFields()
    form.setFieldsValue({
      material_type: 'raw',
      unit: '个',
      tax_rate: 13,
      status: 'active',
      safety_stock: 0,
      standard_price: 0,
    })
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditingRecord(record)
    form.setFieldsValue({
      ...record,
    })
    setModalVisible(true)
  }

  const handleDelete = (record) => {
    confirmDelete(record.name, async () => {
      try {
        await materialApi.delete(record.id)
        message.success('删除成功')
        loadData()
      } catch (e) {
        message.error(e.message || '删除失败')
      }
    })
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (editingRecord) {
        await materialApi.update(editingRecord.id, values)
        message.success('更新成功')
      } else {
        await materialApi.create(values)
        message.success('创建成功')
      }
      setModalVisible(false)
      loadData()
    } catch (e) {
      if (e.errorFields) return
      message.error(e.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    {
      title: '物料编码',
      dataIndex: 'code',
      key: 'code',
      width: 140,
    },
    {
      title: '物料名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
    },
    {
      title: '规格',
      dataIndex: 'specification',
      key: 'specification',
      width: 120,
      render: (v) => v || '-',
    },
    {
      title: '单位',
      dataIndex: 'unit',
      key: 'unit',
      width: 60,
    },
    {
      title: '物料类型',
      dataIndex: 'material_type',
      key: 'material_type',
      width: 100,
      render: (type) => {
        const config = MATERIAL_TYPE_MAP[type] || { text: type, color: 'default' }
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (v) => v || '-',
    },
    {
      title: '标准价格',
      dataIndex: 'standard_price',
      key: 'standard_price',
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
      title: '税率(%)',
      dataIndex: 'tax_rate',
      key: 'tax_rate',
      width: 80,
      align: 'right',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => <BillStatus status={status} />,
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

  const onSearch = (values) => {
    const params = {}
    if (values.keyword) params.keyword = values.keyword
    if (values.material_type) params.material_type = values.material_type
    handleSearch(params)
  }

  return (
    <div>
      <Card title="物料档案">
        {/* 搜索栏 */}
        <Form
          form={searchForm}
          layout="inline"
          onFinish={onSearch}
          style={{ marginBottom: 16 }}
        >
          <Space style={{ width: '100%' }}>
            <Form.Item name="keyword" style={{ marginBottom: 0 }}>
              <Input
                placeholder="物料编码 / 名称"
                allowClear
                prefix={<SearchOutlined />}
                style={{ width: 250 }}
              />
            </Form.Item>
            <Form.Item name="material_type" style={{ marginBottom: 0 }}>
              <Select
                placeholder="物料类型"
                allowClear
                style={{ width: 150 }}
                options={[
                  { label: '原材料', value: 'raw' },
                  { label: '半成品', value: 'semi' },
                  { label: '成品', value: 'finished' },
                ]}
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              查询
            </Button>
            <Button onClick={() => { searchForm.resetFields(); handleReset() }}>
              重置
            </Button>
          </Space>
        </Form>

        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            className="btn-create-material"
          >
            新增物料
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => loadData()}>刷新</Button>
        </Space>

        <Table
          className="material-table"
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

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingRecord ? '编辑物料' : '新增物料'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        okText={editingRecord ? '保存' : '创建'}
        cancelText="取消"
        width={680}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item
              name="code"
              label="物料编码"
              rules={[{ required: true, message: '请输入物料编码' }]}
              style={{ width: '50%', paddingRight: 8 }}
            >
              <Input placeholder="请输入物料编码" />
            </Form.Item>
            <Form.Item
              name="name"
              label="物料名称"
              rules={[{ required: true, message: '请输入物料名称' }]}
              style={{ width: '50%' }}
            >
              <Input placeholder="请输入物料名称" />
            </Form.Item>
          </Space.Compact>

          <Space.Compact style={{ width: '100%' }}>
            <Form.Item
              name="specification"
              label="规格型号"
              style={{ width: '33%', paddingRight: 8 }}
            >
              <Input placeholder="如：10mm" />
            </Form.Item>
            <Form.Item
              name="unit"
              label="计量单位"
              rules={[{ required: true, message: '请输入单位' }]}
              style={{ width: '33%', paddingRight: 8 }}
            >
              <Input placeholder="如：个/kg/m" />
            </Form.Item>
            <Form.Item
              name="material_type"
              label="物料类型"
              rules={[{ required: true, message: '请选择物料类型' }]}
              style={{ width: '34%' }}
            >
              <Select
                options={[
                  { label: '原材料', value: 'raw' },
                  { label: '半成品', value: 'semi' },
                  { label: '成品', value: 'finished' },
                ]}
              />
            </Form.Item>
          </Space.Compact>

          <Space.Compact style={{ width: '100%' }}>
            <Form.Item
              name="category"
              label="分类"
              style={{ width: '50%', paddingRight: 8 }}
            >
              <Input placeholder="如：电子元件" />
            </Form.Item>
            <Form.Item
              name="tax_rate"
              label="税率(%)"
              style={{ width: '50%' }}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                max={100}
                precision={0}
                placeholder="如：13"
              />
            </Form.Item>
          </Space.Compact>

          <Space.Compact style={{ width: '100%' }}>
            <Form.Item
              name="standard_price"
              label="标准价格"
              style={{ width: '50%', paddingRight: 8 }}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={2}
                placeholder="请输入标准价格"
                formatter={(v) => `¥ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(v) => v.replace(/¥\s?|(,*)/g, '')}
              />
            </Form.Item>
            <Form.Item
              name="safety_stock"
              label="安全库存"
              style={{ width: '50%' }}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={2}
                placeholder="请输入安全库存"
              />
            </Form.Item>
          </Space.Compact>

          <Form.Item name="status" label="状态">
            <Select
              options={[
                { label: '启用', value: 'active' },
                { label: '禁用', value: 'inactive' },
              ]}
            />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

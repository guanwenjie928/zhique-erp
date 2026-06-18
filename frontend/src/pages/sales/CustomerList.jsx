import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Space, Form, Input, Modal, Select, InputNumber, message,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
} from '@ant-design/icons'
import { customerApi } from '../../api'
import { useCrudPage, confirmDelete, formatMoney } from '../../components/CrudHelpers'
import BillStatus from '../../components/BillStatus'

export default function CustomerList() {
  const [modalVisible, setModalVisible] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  const {
    data, loading, total, page, pageSize,
    setPage, setPageSize, loadData,
  } = useCrudPage({
    fetchData: customerApi.list,
    initialSearch: {},
  })

  const handleAdd = () => {
    setEditingRecord(null)
    form.resetFields()
    form.setFieldsValue({
      status: 'active',
      payment_terms: '30天',
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
        await customerApi.delete(record.id)
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
        await customerApi.update(editingRecord.id, values)
        message.success('更新成功')
      } else {
        await customerApi.create(values)
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
      title: '客户编码',
      dataIndex: 'code',
      key: 'code',
      width: 120,
    },
    {
      title: '客户名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '简称',
      dataIndex: 'short_name',
      key: 'short_name',
      width: 120,
      render: (v) => v || '-',
    },
    {
      title: '联系人',
      dataIndex: 'contact_person',
      key: 'contact_person',
      width: 100,
      render: (v) => v || '-',
    },
    {
      title: '联系电话',
      dataIndex: 'contact_phone',
      key: 'contact_phone',
      width: 130,
      render: (v) => v || '-',
    },
    {
      title: '信用额度',
      dataIndex: 'credit_limit',
      key: 'credit_limit',
      width: 130,
      align: 'right',
      render: (v) => formatMoney(v),
    },
    {
      title: '付款条件',
      dataIndex: 'payment_terms',
      key: 'payment_terms',
      width: 100,
      render: (v) => v || '-',
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

  return (
    <div>
      <Card title="客户管理">
        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            className="btn-create-customer"
          >
            新增客户
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => loadData()}>刷新</Button>
        </Space>

        <Table
          className="customer-table"
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

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingRecord ? '编辑客户' : '新增客户'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        okText={editingRecord ? '保存' : '创建'}
        cancelText="取消"
        width={640}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item
              name="code"
              label="客户编码"
              rules={[{ required: true, message: '请输入客户编码' }]}
              style={{ width: '50%', paddingRight: 8 }}
            >
              <Input placeholder="请输入客户编码" />
            </Form.Item>
            <Form.Item
              name="short_name"
              label="简称"
              style={{ width: '50%' }}
            >
              <Input placeholder="请输入简称" />
            </Form.Item>
          </Space.Compact>

          <Form.Item
            name="name"
            label="客户名称"
            rules={[{ required: true, message: '请输入客户名称' }]}
          >
            <Input placeholder="请输入客户全称" />
          </Form.Item>

          <Space.Compact style={{ width: '100%' }}>
            <Form.Item
              name="contact_person"
              label="联系人"
              style={{ width: '50%', paddingRight: 8 }}
            >
              <Input placeholder="请输入联系人" />
            </Form.Item>
            <Form.Item
              name="contact_phone"
              label="联系电话"
              style={{ width: '50%' }}
            >
              <Input placeholder="请输入联系电话" />
            </Form.Item>
          </Space.Compact>

          <Space.Compact style={{ width: '100%' }}>
            <Form.Item
              name="credit_limit"
              label="信用额度"
              style={{ width: '50%', paddingRight: 8 }}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={2}
                placeholder="请输入信用额度"
                formatter={(v) => `¥ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(v) => v.replace(/¥\s?|(,*)/g, '')}
              />
            </Form.Item>
            <Form.Item
              name="payment_terms"
              label="付款条件"
              style={{ width: '50%' }}
            >
              <Input placeholder="如：30天" />
            </Form.Item>
          </Space.Compact>

          <Form.Item name="address" label="地址">
            <Input.TextArea rows={2} placeholder="请输入地址" />
          </Form.Item>

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

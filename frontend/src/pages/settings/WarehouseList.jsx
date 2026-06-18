import React, { useState } from 'react'
import {
  Card, Table, Button, Space, Form, Input, Select, Modal, message,
} from 'antd'
import {
  PlusOutlined, EditOutlined, ReloadOutlined,
} from '@ant-design/icons'
import { warehouseApi } from '../../api'
import { useCrudPage } from '../../components/CrudHelpers'
import BillStatus from '../../components/BillStatus'

export default function WarehouseList() {
  const [modalVisible, setModalVisible] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  const {
    data, loading, total, page, pageSize,
    setPage, setPageSize, loadData,
  } = useCrudPage({
    fetchData: warehouseApi.list,
    initialSearch: {},
  })

  const handleAdd = () => {
    setEditingRecord(null)
    form.resetFields()
    form.setFieldsValue({
      status: 'active',
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

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (editingRecord) {
        await warehouseApi.update(editingRecord.id, values)
        message.success('更新成功')
      } else {
        await warehouseApi.create(values)
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
      title: '仓库编码',
      dataIndex: 'code',
      key: 'code',
      width: 120,
    },
    {
      title: '仓库名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      width: 300,
      ellipsis: true,
      render: (v) => v || '-',
    },
    {
      title: '负责人',
      dataIndex: 'manager',
      key: 'manager',
      width: 120,
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
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => handleEdit(record)}
        >
          编辑
        </Button>
      ),
    },
  ]

  return (
    <div>
      <Card title="仓库管理">
        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            className="btn-create-warehouse"
          >
            新增仓库
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => loadData()}>刷新</Button>
        </Space>

        <Table
          className="warehouse-table"
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 900 }}
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
        title={editingRecord ? '编辑仓库' : '新增仓库'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        okText={editingRecord ? '保存' : '创建'}
        cancelText="取消"
        width={560}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item
              name="code"
              label="仓库编码"
              rules={[{ required: true, message: '请输入仓库编码' }]}
              style={{ width: '50%', paddingRight: 8 }}
            >
              <Input placeholder="如：WH001" />
            </Form.Item>
            <Form.Item
              name="name"
              label="仓库名称"
              rules={[{ required: true, message: '请输入仓库名称' }]}
              style={{ width: '50%' }}
            >
              <Input placeholder="如：原料仓" />
            </Form.Item>
          </Space.Compact>

          <Form.Item name="address" label="地址">
            <Input.TextArea rows={2} placeholder="请输入仓库地址" />
          </Form.Item>

          <Space.Compact style={{ width: '100%' }}>
            <Form.Item
              name="manager"
              label="负责人"
              style={{ width: '50%', paddingRight: 8 }}
            >
              <Input placeholder="请输入负责人" />
            </Form.Item>
            <Form.Item
              name="status"
              label="状态"
              style={{ width: '50%' }}
            >
              <Select
                options={[
                  { label: '启用', value: 'active' },
                  { label: '禁用', value: 'inactive' },
                ]}
              />
            </Form.Item>
          </Space.Compact>

          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

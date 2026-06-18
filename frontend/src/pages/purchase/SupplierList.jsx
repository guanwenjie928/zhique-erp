import React, { useState, useEffect, useRef } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Select,
  Tag,
  Row,
  Col,
  Form,
  Typography,
  Modal,
  message,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import {
  supplierApi,
} from '../../api'
import {
  useCrudPage,
  confirmDelete,
  formatDate,
} from '../../components/CrudHelpers'

const { Title } = Typography

const STATUS_OPTIONS = [
  { value: 'active', label: '启用' },
  { value: 'inactive', label: '停用' },
]

const RATING_OPTIONS = [
  { value: 'A', label: 'A 优质供应商' },
  { value: 'B', label: 'B 合格供应商' },
  { value: 'C', label: 'C 待改进供应商' },
]

const RATING_COLOR_MAP = {
  A: 'green',
  B: 'blue',
  C: 'orange',
}

export default function SupplierList() {
  const [searchForm] = Form.useForm()
  const [modalForm] = Form.useForm()
  const [modalVisible, setModalVisible] = useState(false)
  const [modalMode, setModalMode] = useState('create') // create | edit
  const [editingId, setEditingId] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)

  const {
    data,
    loading,
    total,
    page,
    pageSize,
    setPage,
    setPageSize,
    handleSearch,
    handleReset,
    loadData,
  } = useCrudPage({
    fetchData: supplierApi.list,
    initialSearch: {},
  })

  // 打开新建弹窗
  const handleCreate = () => {
    setModalMode('create')
    setEditingId(null)
    modalForm.resetFields()
    modalForm.setFieldsValue({
      status: 'active',
      rating: 'B',
      payment_terms: '月结30天',
    })
    setModalVisible(true)
  }

  // 打开编辑弹窗
  const handleEdit = async (record) => {
    setModalMode('edit')
    setEditingId(record.id)
    setModalVisible(true)
    try {
      // 如果列表数据完整就直接用，否则从详情接口获取
      const detail = await supplierApi.get(record.id)
      modalForm.setFieldsValue({
        code: detail.code,
        name: detail.name,
        short_name: detail.short_name,
        contact_person: detail.contact_person,
        contact_phone: detail.contact_phone,
        contact_email: detail.contact_email,
        address: detail.address,
        bank_name: detail.bank_name,
        bank_account: detail.bank_account,
        tax_number: detail.tax_number,
        payment_terms: detail.payment_terms,
        rating: detail.rating,
        status: detail.status,
        remark: detail.remark,
      })
    } catch (e) {
      // 使用列表数据
      modalForm.setFieldsValue({
        code: record.code,
        name: record.name,
        short_name: record.short_name,
        contact_person: record.contact_person,
        contact_phone: record.contact_phone,
        contact_email: record.contact_email,
        address: record.address,
        bank_name: record.bank_name,
        bank_account: record.bank_account,
        tax_number: record.tax_number,
        payment_terms: record.payment_terms,
        rating: record.rating,
        status: record.status,
        remark: record.remark,
      })
    }
  }

  // 删除
  const handleDelete = (record) => {
    confirmDelete(record.name, async () => {
      try {
        await supplierApi.delete(record.id)
        message.success('删除成功')
        loadData()
      } catch (e) {
        message.error(e.message || '删除失败')
      }
    })
  }

  // 保存（新建/编辑）
  const handleModalOk = async () => {
    try {
      const values = await modalForm.validateFields()
      setModalLoading(true)
      if (modalMode === 'create') {
        await supplierApi.create(values)
        message.success('新增成功')
      } else {
        await supplierApi.update(editingId, values)
        message.success('修改成功')
      }
      setModalVisible(false)
      loadData()
    } catch (e) {
      if (e.errorFields) return // form validation error
      message.error(e.message || '保存失败')
    } finally {
      setModalLoading(false)
    }
  }

  const handleModalCancel = () => {
    setModalVisible(false)
    modalForm.resetFields()
  }

  const columns = [
    {
      title: '供应商编码',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      fixed: 'left',
    },
    {
      title: '供应商名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: '简称',
      dataIndex: 'short_name',
      key: 'short_name',
      width: 100,
      render: (text) => text || '-',
    },
    {
      title: '联系人',
      dataIndex: 'contact_person',
      key: 'contact_person',
      width: 100,
      render: (text) => text || '-',
    },
    {
      title: '联系电话',
      dataIndex: 'contact_phone',
      key: 'contact_phone',
      width: 130,
      render: (text) => text || '-',
    },
    {
      title: '评级',
      dataIndex: 'rating',
      key: 'rating',
      width: 80,
      align: 'center',
      render: (rating) => {
        if (!rating) return '-'
        return <Tag color={RATING_COLOR_MAP[rating] || 'default'}>{rating}</Tag>
      },
    },
    {
      title: '付款条件',
      dataIndex: 'payment_terms',
      key: 'payment_terms',
      width: 120,
      render: (text) => text || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => {
        if (status === 'active') return <Tag color="success">启用</Tag>
        return <Tag color="default">停用</Tag>
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              className="btn-edit-supplier"
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          />
        </Space>
      ),
    },
  ]

  return (
    <div className="page-supplier-list">
      <Card
        title={<Title level={4} style={{ margin: 0 }}>供应商管理</Title>}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            className="btn-create-supplier"
            onClick={handleCreate}
          >
            新增供应商
          </Button>
        }
      >
        {/* 搜索栏 */}
        <Form
          form={searchForm}
          layout="inline"
          style={{ marginBottom: 16 }}
          onFinish={handleSearch}
        >
          <Row gutter={[16, 16]} style={{ width: '100%' }}>
            <Col>
              <Form.Item name="keyword" label="关键词">
                <Input
                  placeholder="编码 / 名称"
                  allowClear
                  style={{ width: 200 }}
                />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item name="status" label="状态">
                <Select
                  placeholder="全部状态"
                  allowClear
                  style={{ width: 120 }}
                  options={STATUS_OPTIONS}
                />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item name="rating" label="评级">
                <Select
                  placeholder="全部评级"
                  allowClear
                  style={{ width: 160 }}
                  options={RATING_OPTIONS}
                />
              </Form.Item>
            </Col>
            <Col>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SearchOutlined />}
                >
                  查询
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    searchForm.resetFields()
                    handleReset()
                  }}
                >
                  重置
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
        />
      </Card>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={modalMode === 'create' ? '新增供应商' : '编辑供应商'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        confirmLoading={modalLoading}
        width={720}
        okText="保存"
        cancelText="取消"
        destroyOnClose
        className="modal-supplier-form"
      >
        <Form
          form={modalForm}
          layout="vertical"
          preserve={false}
        >
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label="供应商编码"
                name="code"
                rules={[{ required: true, message: '请输入供应商编码' }]}
              >
                <Input placeholder="如：SUP001" disabled={modalMode === 'edit'} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="供应商名称"
                name="name"
                rules={[{ required: true, message: '请输入供应商名称' }]}
              >
                <Input placeholder="供应商全称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="简称" name="short_name">
                <Input placeholder="供应商简称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="联系人" name="contact_person">
                <Input placeholder="联系人姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="联系电话" name="contact_phone">
                <Input placeholder="联系电话" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="联系邮箱" name="contact_email">
                <Input placeholder="电子邮箱" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="开户银行" name="bank_name">
                <Input placeholder="开户银行名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="银行账号" name="bank_account">
                <Input placeholder="银行账号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="税号" name="tax_number">
                <Input placeholder="纳税人识别号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="付款条件" name="payment_terms">
                <Input placeholder="如：月结30天" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="地址" name="address">
                <Input placeholder="详细地址" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="评级"
                name="rating"
                rules={[{ required: true, message: '请选择评级' }]}
              >
                <Select options={RATING_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="状态"
                name="status"
                rules={[{ required: true, message: '请选择状态' }]}
              >
                <Select options={STATUS_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="备注" name="remark">
                <Input.TextArea
                  rows={2}
                  placeholder="备注信息"
                  maxLength={500}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

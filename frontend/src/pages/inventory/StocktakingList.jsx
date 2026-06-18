import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Space, Form, Input, Select, Modal, message, DatePicker,
} from 'antd'
import { PlusOutlined, AuditOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { stocktakingApi, warehouseApi } from '../../api'
import { useCrudPage, confirmAudit, formatDate, formatDateTime } from '../../components/CrudHelpers'
import BillStatus from '../../components/BillStatus'

export default function StocktakingList() {
  const [warehouses, setWarehouses] = useState([])
  const [modalVisible, setModalVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentRecord, setCurrentRecord] = useState(null)
  const [detailItems, setDetailItems] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  const {
    data, loading, total, page, pageSize,
    setPage, setPageSize, handleSearch, handleReset, loadData,
  } = useCrudPage({
    fetchData: stocktakingApi.list,
    initialSearch: {},
  })

  useEffect(() => {
    warehouseApi.list().then((res) => {
      setWarehouses(res.items || res || [])
    }).catch(console.error)
  }, [])

  // 生成单号
  const generateBillNo = () => {
    const now = dayjs()
    return `PD${now.format('YYYYMMDD')}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
  }

  const handleCreate = () => {
    form.resetFields()
    form.setFieldsValue({
      bill_no: generateBillNo(),
      bill_date: dayjs(),
      warehouse_id: undefined,
      remark: '',
    })
    setModalVisible(true)
  }

  const handleCreateSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = {
        ...values,
        bill_date: values.bill_date ? values.bill_date.format('YYYY-MM-DD') : undefined,
      }
      await stocktakingApi.create(payload)
      message.success('盘点单创建成功')
      setModalVisible(false)
      loadData()
    } catch (e) {
      if (e.errorFields) return // validation error
      message.error(e.message || '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAudit = (record) => {
    confirmAudit(record.bill_no, async () => {
      try {
        await stocktakingApi.audit(record.id)
        message.success('审核成功')
        loadData()
      } catch (e) {
        message.error(e.message || '审核失败')
      }
    })
  }

  const handleView = async (record) => {
    setCurrentRecord(record)
    setDetailVisible(true)
    setDetailLoading(true)
    try {
      const detail = await stocktakingApi.get(record.id)
      setDetailItems(detail.items || detail.details || [])
    } catch (e) {
      message.error(e.message || '加载详情失败')
    } finally {
      setDetailLoading(false)
    }
  }

  const columns = [
    {
      title: '盘点单号',
      dataIndex: 'bill_no',
      key: 'bill_no',
      width: 180,
    },
    {
      title: '盘点日期',
      dataIndex: 'bill_date',
      key: 'bill_date',
      width: 120,
      render: (v) => formatDate(v),
    },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
      key: 'warehouse_name',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <BillStatus status={status} />,
    },
    {
      title: '制单人',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v) => formatDateTime(v),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 200,
      ellipsis: true,
      render: (v) => v || '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
          {record.status === 'submitted' && (
            <Button
              type="link"
              size="small"
              icon={<AuditOutlined />}
              onClick={() => handleAudit(record)}
              className="btn-audit-stocktaking"
            >
              审核
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const detailColumns = [
    { title: '物料编码', dataIndex: 'material_code', key: 'material_code', width: 140 },
    { title: '物料名称', dataIndex: 'material_name', key: 'material_name', width: 180 },
    { title: '规格', dataIndex: 'specification', key: 'specification', width: 120 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 60 },
    {
      title: '账面数量',
      dataIndex: 'book_quantity',
      key: 'book_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '实盘数量',
      dataIndex: 'actual_quantity',
      key: 'actual_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '差异',
      key: 'diff',
      width: 100,
      align: 'right',
      render: (_, record) => {
        const diff = (record.actual_quantity || 0) - (record.book_quantity || 0)
        const color = diff > 0 ? '#52c41a' : diff < 0 ? '#ff4d4f' : ''
        return <span style={{ color }}>{diff > 0 ? `+${diff}` : diff}</span>
      },
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 200,
      render: (v) => v || '-',
    },
  ]

  return (
    <div>
      <Card title="库存盘点">
        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            className="btn-create-stocktaking"
          >
            新建盘点
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => loadData()}>刷新</Button>
        </Space>

        <Table
          className="stocktaking-table"
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

      {/* 新建盘点弹窗 */}
      <Modal
        title="新建盘点单"
        open={modalVisible}
        onOk={handleCreateSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        okText="创建"
        cancelText="取消"
        width={560}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="bill_no"
            label="盘点单号"
            rules={[{ required: true, message: '请输入盘点单号' }]}
          >
            <Input placeholder="自动生成，可手动修改" />
          </Form.Item>
          <Form.Item
            name="bill_date"
            label="盘点日期"
            rules={[{ required: true, message: '请选择盘点日期' }]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item
            name="warehouse_id"
            label="盘点仓库"
            rules={[{ required: true, message: '请选择仓库' }]}
          >
            <Select
              placeholder="请选择仓库"
              options={warehouses.map((w) => ({
                label: w.name,
                value: w.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 盘点详情弹窗 */}
      <Modal
        title={`盘点详情 - ${currentRecord?.bill_no || ''}`}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={900}
      >
        <Table
          columns={detailColumns}
          dataSource={detailItems}
          rowKey={(record, index) => record.id || index}
          loading={detailLoading}
          pagination={false}
          size="small"
          scroll={{ y: 400 }}
        />
      </Modal>
    </div>
  )
}

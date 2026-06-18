import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Button,
  Space,
  Row,
  Col,
  Table,
  Typography,
  message,
  Spin,
  Statistic,
} from 'antd'
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  CheckOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  purchaseReceiptApi,
  purchaseOrderApi,
  supplierApi,
  warehouseApi,
  departmentApi,
  userApi,
} from '../../api'
import {
  confirmAudit,
  formatMoney,
} from '../../components/CrudHelpers'
import BillStatus from '../../components/BillStatus'
import { useAppStore } from '../../stores/appStore'

const { Title, Text } = Typography

function round2(num) {
  return Math.round((Number(num) || 0) * 100) / 100
}

export default function PurchaseReceiptDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isNew = !id || id === 'new'
  const sourceBillNo = searchParams.get('source_bill_no')
  const sourceBillId = searchParams.get('source_bill_id')
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [record, setRecord] = useState(null)
  const [items, setItems] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [users, setUsers] = useState([])
  const currentUser = useAppStore((s) => s.currentUser)

  // 加载选项数据
  useEffect(() => {
    supplierApi.list({ limit: 9999 }).then((res) => {
      setSuppliers(res.items || res || [])
    }).catch(() => {})
    warehouseApi.list({ limit: 9999 }).then((res) => {
      setWarehouses(res.items || res || [])
    }).catch(() => {})
    userApi.list().then((res) => {
      setUsers(res.items || res || [])
    }).catch(() => {})
  }, [])

  // 从采购订单下推 - 加载来源数据
  const loadSourceData = useCallback(async () => {
    if (!sourceBillId) return false
    try {
      const source = await purchaseOrderApi.get(sourceBillId)
      form.setFieldsValue({
        bill_date: dayjs(),
        supplier_id: source.supplier_id,
        order_no: source.bill_no,
        order_id: source.id,
        receiver_id: currentUser?.id,
        expected_date: source.expected_date ? dayjs(source.expected_date) : null,
      })
      const sourceItems = (source.items || []).map((item, idx) => {
        const mat = item.material || {}
        const quantity = Number(item.quantity) || 0
        const unitPrice = Number(item.unit_price) || 0
        const amount = round2(quantity * unitPrice)
        return {
          key: item.id || Date.now() + idx,
          material_id: item.material_id,
          material_code: mat.code,
          material_name: mat.name,
          specification: mat.specification,
          unit: mat.unit,
          order_quantity: quantity,
          received_quantity: quantity,
          qualified_quantity: quantity,
          unit_price: unitPrice,
          amount: amount,
          batch_no: '',
        }
      })
      setItems(sourceItems)
      return true
    } catch (e) {
      message.error('加载来源单据失败: ' + (e.message || ''))
      return false
    }
  }, [sourceBillId, form, currentUser])

  // 加载已有数据
  const loadRecord = useCallback(async () => {
    if (isNew) {
      if (sourceBillId) {
        const loaded = await loadSourceData()
        if (loaded) return
      }
      // 新建默认值
      form.setFieldsValue({
        bill_date: dayjs(),
        receiver_id: currentUser?.id,
      })
      setItems([{ key: Date.now(), material_id: null, order_quantity: 0, received_quantity: 0, qualified_quantity: 0, unit_price: 0, amount: 0, batch_no: '' }])
      return
    }
    setLoading(true)
    try {
      const res = await purchaseReceiptApi.get(id)
      setRecord(res)
      form.setFieldsValue({
        bill_no: res.bill_no,
        bill_date: res.bill_date ? dayjs(res.bill_date) : null,
        supplier_id: res.supplier_id,
        order_no: res.order_no,
        order_id: res.order_id,
        warehouse_id: res.warehouse_id,
        receiver_id: res.receiver_id,
        inspect_status: res.inspect_status,
        remark: res.remark,
      })
      const loadedItems = (res.items || []).map((item, idx) => ({
        key: item.id || Date.now() + idx,
        id: item.id,
        material_id: item.material_id,
        material_code: item.material?.code,
        material_name: item.material?.name,
        specification: item.material?.specification,
        unit: item.material?.unit,
        order_quantity: Number(item.order_quantity) || 0,
        received_quantity: Number(item.received_quantity) || 0,
        qualified_quantity: Number(item.qualified_quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
        amount: Number(item.amount) || 0,
        batch_no: item.batch_no || '',
      }))
      setItems(loadedItems.length > 0 ? loadedItems : [{ key: Date.now(), material_id: null, order_quantity: 0, received_quantity: 0, qualified_quantity: 0, unit_price: 0, amount: 0, batch_no: '' }])
    } catch (e) {
      message.error(e.message || '加载数据失败')
    } finally {
      setLoading(false)
    }
  }, [id, isNew, form, currentUser, sourceBillId, loadSourceData])

  useEffect(() => {
    loadRecord()
  }, [loadRecord])

  const status = record?.status
  const isReadOnly = status === 'submitted' || status === 'audited'

  // 行金额计算
  const calcRowAmount = (item) => {
    const qualifiedQty = Number(item.qualified_quantity) || 0
    const unitPrice = Number(item.unit_price) || 0
    return round2(qualifiedQty * unitPrice)
  }

  // 合计
  const totals = useMemo(() => {
    return items.reduce((acc, item) => {
      acc.total_quantity = round2(acc.total_quantity + (Number(item.received_quantity) || 0))
      acc.total_qualified = round2(acc.total_qualified + (Number(item.qualified_quantity) || 0))
      acc.total_amount = round2(acc.total_amount + calcRowAmount(item))
      return acc
    }, { total_quantity: 0, total_qualified: 0, total_amount: 0 })
  }, [items])

  // 物料明细操作
  const handleAddItem = () => {
    setItems([...items, {
      key: Date.now(),
      material_id: null,
      order_quantity: 0,
      received_quantity: 0,
      qualified_quantity: 0,
      unit_price: 0,
      amount: 0,
      batch_no: '',
    }])
  }

  const handleDeleteItem = (key) => {
    setItems(items.filter((item) => item.key !== key))
  }

  const handleItemChange = (key, field, value) => {
    setItems(items.map((item) => {
      if (item.key !== key) return item
      const updated = { ...item, [field]: value }
      // 实收数量或合格数量或单价变化时重新计算金额
      if (field === 'qualified_quantity' || field === 'unit_price') {
        updated.amount = calcRowAmount(updated)
      }
      return updated
    }))
  }

  // 收集表单数据
  const collectData = (submitAction = 'save') => {
    const values = form.getFieldsValue()
    const data = {
      bill_date: values.bill_date ? values.bill_date.format('YYYY-MM-DD') : null,
      supplier_id: values.supplier_id,
      order_no: values.order_no || (sourceBillNo || ''),
      order_id: values.order_id,
      warehouse_id: values.warehouse_id,
      receiver_id: values.receiver_id,
      remark: values.remark || '',
      total_quantity: totals.total_quantity,
      total_amount: totals.total_amount,
      items: items
        .filter((item) => item.material_id)
        .map((item) => ({
          id: item.id,
          material_id: item.material_id,
          order_quantity: Number(item.order_quantity) || 0,
          received_quantity: Number(item.received_quantity) || 0,
          qualified_quantity: Number(item.qualified_quantity) || 0,
          unit_price: Number(item.unit_price) || 0,
          amount: calcRowAmount(item),
          batch_no: item.batch_no || '',
        })),
    }
    if (submitAction === 'submit') {
      data.status = 'submitted'
    }
    return data
  }

  // 验证
  const validateForm = () => {
    const validItems = items.filter((item) => item.material_id)
    if (validItems.length === 0) {
      message.warning('请至少添加一条物料明细')
      return false
    }
    for (const item of validItems) {
      if (Number(item.received_quantity) <= 0) {
        message.warning('实收数量必须大于0')
        return false
      }
      if (Number(item.qualified_quantity) > Number(item.received_quantity)) {
        message.warning('合格数量不能大于实收数量')
        return false
      }
    }
    return true
  }

  // 保存
  const handleSave = async (submitAction = 'save') => {
    try {
      const values = await form.validateFields()
      if (!validateForm()) return

      setSaving(true)
      const data = collectData(submitAction)
      if (isNew) {
        const res = await purchaseReceiptApi.create(data)
        message.success('保存成功')
        navigate(`/purchase/receipts/${res.id}`)
      } else {
        await purchaseReceiptApi.update(id, data)
        message.success('保存成功')
        loadRecord()
      }
    } catch (e) {
      if (e.errorFields) return
      message.error(e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 审核（审核后更新库存、生成应付）
  const handleAudit = () => {
    confirmAudit(record.bill_no, async () => {
      try {
        await purchaseReceiptApi.audit(id)
        message.success('审核成功，库存已更新，应付已生成')
        loadRecord()
      } catch (e) {
        message.error(e.message || '审核失败')
      }
    })
  }

  const itemColumns = [
    {
      title: '序号',
      width: 50,
      render: (_, __, idx) => idx + 1,
    },
    {
      title: '物料编码',
      dataIndex: 'material_id',
      key: 'material_id',
      width: 180,
      render: (val, record) => {
        if (isReadOnly) return <Text>{record.material_code || '-'}</Text>
        // 如果来自下推，物料已锁定不可改
        if (sourceBillId) return <Text>{record.material_code} - {record.material_name}</Text>
        return (
          <Input
            value={`${record.material_code || ''} ${record.material_name || ''}`}
            placeholder="请选择物料"
            disabled
          />
        )
      },
    },
    {
      title: '物料名称',
      dataIndex: 'material_name',
      key: 'material_name',
      width: 150,
      render: (text) => text || '-',
    },
    {
      title: '规格',
      dataIndex: 'specification',
      key: 'specification',
      width: 100,
      render: (text) => text || '-',
    },
    {
      title: '单位',
      dataIndex: 'unit',
      key: 'unit',
      width: 70,
      render: (text) => text || '-',
    },
    {
      title: '订单数量',
      dataIndex: 'order_quantity',
      key: 'order_quantity',
      width: 100,
      align: 'right',
      render: (val) => val ?? '-',
    },
    {
      title: '实收数量',
      dataIndex: 'received_quantity',
      key: 'received_quantity',
      width: 110,
      render: (val, record) => {
        if (isReadOnly) return <Text>{val}</Text>
        return (
          <InputNumber
            value={val}
            min={0}
            precision={2}
            style={{ width: '100%' }}
            onChange={(v) => {
              handleItemChange(record.key, 'received_quantity', v)
              // 默认合格数量等于实收数量
              handleItemChange(record.key, 'qualified_quantity', v)
            }}
          />
        )
      },
    },
    {
      title: '合格数量',
      dataIndex: 'qualified_quantity',
      key: 'qualified_quantity',
      width: 110,
      render: (val, record) => {
        if (isReadOnly) return <Text>{val}</Text>
        return (
          <InputNumber
            value={val}
            min={0}
            precision={2}
            style={{ width: '100%' }}
            onChange={(v) => handleItemChange(record.key, 'qualified_quantity', v)}
          />
        )
      },
    },
    {
      title: '单价',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 110,
      align: 'right',
      render: (val, record) => {
        if (isReadOnly) return <Text>{formatMoney(val)}</Text>
        return (
          <InputNumber
            value={val}
            min={0}
            precision={2}
            style={{ width: '100%' }}
            onChange={(v) => handleItemChange(record.key, 'unit_price', v)}
          />
        )
      },
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right',
      render: (val) => <Text strong>{formatMoney(val)}</Text>,
    },
    {
      title: '批号',
      dataIndex: 'batch_no',
      key: 'batch_no',
      width: 120,
      render: (val, record) => {
        if (isReadOnly) return <Text>{val || '-'}</Text>
        return (
          <Input
            value={val}
            placeholder="批号"
            onChange={(e) => handleItemChange(record.key, 'batch_no', e.target.value)}
          />
        )
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 60,
      render: (_, record) => {
        if (isReadOnly) return null
        return (
          <Button
            type="link"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteItem(record.key)}
          />
        )
      },
    },
  ]

  return (
    <Spin spinning={loading}>
      <div className="page-purchase-receipt-detail">
        {/* 头部 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space>
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate('/purchase/receipts')}
                >
                  返回
                </Button>
                <Title level={4} style={{ margin: 0 }}>
                  采购入库单
                  {record?.bill_no && <Text type="secondary" style={{ marginLeft: 8, fontSize: 14 }}>{record.bill_no}</Text>}
                </Title>
                {status && <BillStatus status={status} />}
              </Space>
            </Col>
            <Col>
              <Space>
                {!isReadOnly && (
                  <>
                    <Button
                      icon={<SaveOutlined />}
                      loading={saving}
                      onClick={() => handleSave('save')}
                    >
                      保存
                    </Button>
                    {(isNew || status === 'draft') && (
                      <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        loading={saving}
                        className="btn-save-submit"
                        onClick={() => handleSave('submit')}
                      >
                        保存并提交
                      </Button>
                    )}
                  </>
                )}
                {status === 'submitted' && (
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    className="btn-audit"
                    onClick={handleAudit}
                  >
                    审核
                  </Button>
                )}
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 来源单据信息 */}
        {(record?.order_no || sourceBillNo) && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space>
              <LinkOutlined />
              <Text>来源采购订单：</Text>
              <Text strong>{record?.order_no || sourceBillNo}</Text>
              {(record?.order_id || sourceBillId) && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => navigate(`/purchase/orders/${record?.order_id || sourceBillId}`)}
                >
                  查看来源
                </Button>
              )}
            </Space>
          </Card>
        )}

        {/* 基本信息 */}
        <Card title="基本信息" size="small" style={{ marginBottom: 16 }}>
          <Form form={form} layout="vertical">
            <Row gutter={24}>
              <Col span={6}>
                <Form.Item label="单据编号" name="bill_no">
                  <Input placeholder="保存时自动生成" disabled />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  label="单据日期"
                  name="bill_date"
                  rules={[{ required: true, message: '请选择单据日期' }]}
                >
                  <DatePicker style={{ width: '100%' }} disabled={isReadOnly} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  label="供应商"
                  name="supplier_id"
                  rules={[{ required: true, message: '请选择供应商' }]}
                >
                  <Select
                    placeholder="请选择供应商"
                    disabled={isReadOnly}
                    showSearch
                    optionFilterProp="label"
                    className="form-supplier"
                    options={suppliers.map((s) => ({
                      value: s.id,
                      label: `${s.code} - ${s.name}`,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="源采购订单" name="order_no">
                  <Input placeholder="下推时自动填入" disabled />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  label="入库仓库"
                  name="warehouse_id"
                  rules={[{ required: true, message: '请选择入库仓库' }]}
                >
                  <Select
                    placeholder="请选择仓库"
                    disabled={isReadOnly}
                    className="form-warehouse"
                    options={warehouses.map((w) => ({
                      value: w.id,
                      label: w.name,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="收货人" name="receiver_id">
                  <Select
                    placeholder="请选择收货人"
                    disabled={isReadOnly}
                    options={users.map((u) => ({
                      value: u.id,
                      label: u.real_name || u.username,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="备注" name="remark">
                  <Input.TextArea
                    rows={1}
                    placeholder="备注信息"
                    disabled={isReadOnly}
                    maxLength={500}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>

        {/* 物料明细 */}
        <Card
          title="物料明细"
          size="small"
          style={{ marginBottom: 16 }}
          extra={
            !isReadOnly && !sourceBillId && (
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                className="btn-add-item"
                onClick={handleAddItem}
              >
                添加行
              </Button>
            )
          }
        >
          <Table
            rowKey="key"
            columns={itemColumns}
            dataSource={items}
            pagination={false}
            size="small"
            scroll={{ x: 1300 }}
          />
        </Card>

        {/* 合计 */}
        <Card title="合计" size="small">
          <Row gutter={48}>
            <Col span={8}>
              <Statistic
                title="实收数量合计"
                value={totals.total_quantity}
                precision={2}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="合格数量合计"
                value={totals.total_qualified}
                precision={2}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="入库金额合计"
                value={totals.total_amount}
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#cf1322', fontWeight: 'bold' }}
              />
            </Col>
          </Row>
        </Card>
      </div>
    </Spin>
  )
}

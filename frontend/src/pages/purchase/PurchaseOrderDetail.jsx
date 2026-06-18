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
  Divider,
  Typography,
  message,
  Spin,
  Descriptions,
  Statistic,
} from 'antd'
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  CheckOutlined,
  DownOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  purchaseOrderApi,
  purchaseRequestApi,
  materialApi,
  supplierApi,
  departmentApi,
  userApi,
} from '../../api'
import {
  confirmAudit,
  formatMoney,
  formatDate,
} from '../../components/CrudHelpers'
import BillStatus from '../../components/BillStatus'
import { useAppStore } from '../../stores/appStore'

const { Title, Text } = Typography

// 精确小数计算工具
function round2(num) {
  return Math.round((Number(num) || 0) * 100) / 100
}

export default function PurchaseOrderDetail() {
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
  const [materials, setMaterials] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [departments, setDepartments] = useState([])
  const [users, setUsers] = useState([])
  const currentUser = useAppStore((s) => s.currentUser)

  // 加载选项数据
  useEffect(() => {
    materialApi.list({ limit: 9999 }).then((res) => {
      setMaterials(res.items || res || [])
    }).catch(() => {})
    supplierApi.list({ limit: 9999 }).then((res) => {
      setSuppliers(res.items || res || [])
    }).catch(() => {})
    departmentApi.list().then((res) => {
      setDepartments(res.items || res || [])
    }).catch(() => {})
    userApi.list().then((res) => {
      setUsers(res.items || res || [])
    }).catch(() => {})
  }, [])

  // 从采购申请单下推 - 加载来源数据
  const loadSourceData = useCallback(async () => {
    if (!sourceBillId) return false
    try {
      const source = await purchaseRequestApi.get(sourceBillId)
      form.setFieldsValue({
        bill_date: dayjs(),
        expected_date: source.expected_date ? dayjs(source.expected_date) : dayjs().add(7, 'day'),
        department_id: source.department_id,
        buyer_id: currentUser?.id,
        reason: source.reason,
        source_bill_no: source.bill_no,
      })
      const sourceItems = (source.items || []).map((item, idx) => {
        const mat = item.material || {}
        const standardPrice = mat.standard_price || 0
        const taxRate = mat.tax_rate || 13
        const quantity = Number(item.quantity) || 0
        const amount = round2(quantity * standardPrice)
        const taxAmount = round2(amount * taxRate / 100)
        return {
          key: item.id || Date.now() + idx,
          material_id: item.material_id,
          material_code: mat.code,
          material_name: mat.name,
          specification: mat.specification,
          unit: mat.unit,
          quantity: quantity,
          unit_price: standardPrice,
          tax_rate: taxRate,
          amount: amount,
          tax_amount: taxAmount,
          total_amount: round2(amount + taxAmount),
          remark: item.remark,
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
      // 检查是否来自下推
      if (sourceBillId) {
        const loaded = await loadSourceData()
        if (loaded) return
      }
      // 新建默认值
      const today = dayjs()
      form.setFieldsValue({
        bill_date: today,
        expected_date: today.add(7, 'day'),
        buyer_id: currentUser?.id,
        payment_terms: '月结30天',
        delivery_address: '公司总部仓库',
      })
      setItems([{ key: Date.now(), material_id: null, quantity: 1, unit_price: 0, tax_rate: 13, amount: 0, tax_amount: 0, total_amount: 0 }])
      return
    }
    setLoading(true)
    try {
      const res = await purchaseOrderApi.get(id)
      setRecord(res)
      form.setFieldsValue({
        bill_no: res.bill_no,
        bill_date: res.bill_date ? dayjs(res.bill_date) : null,
        supplier_id: res.supplier_id,
        department_id: res.department_id,
        buyer_id: res.buyer_id,
        expected_date: res.expected_date ? dayjs(res.expected_date) : null,
        payment_terms: res.payment_terms,
        delivery_address: res.delivery_address,
        source_bill_no: res.source_bill_no,
        reason: res.reason,
      })
      const loadedItems = (res.items || []).map((item, idx) => ({
        key: item.id || Date.now() + idx,
        id: item.id,
        material_id: item.material_id,
        material_code: item.material?.code,
        material_name: item.material?.name,
        specification: item.material?.specification,
        unit: item.material?.unit,
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
        tax_rate: Number(item.tax_rate) || 0,
        amount: Number(item.amount) || 0,
        tax_amount: Number(item.tax_amount) || 0,
        total_amount: Number(item.total_amount) || 0,
        remark: item.remark,
      }))
      setItems(loadedItems.length > 0 ? loadedItems : [{ key: Date.now(), material_id: null, quantity: 1, unit_price: 0, tax_rate: 13, amount: 0, tax_amount: 0, total_amount: 0 }])
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
  const isReadOnly = status === 'submitted' || status === 'audited' || status === 'partial_receipt' || status === 'receipted' || status === 'closed'

  // 计算行金额
  const calcRowAmount = (item) => {
    const quantity = Number(item.quantity) || 0
    const unitPrice = Number(item.unit_price) || 0
    const taxRate = Number(item.tax_rate) || 0
    const amount = round2(quantity * unitPrice)
    const taxAmount = round2(amount * taxRate / 100)
    const totalAmount = round2(amount + taxAmount)
    return { amount, tax_amount: taxAmount, total_amount: totalAmount }
  }

  // 金额合计
  const totals = useMemo(() => {
    return items.reduce((acc, item) => {
      const calc = calcRowAmount(item)
      acc.total_amount = round2(acc.total_amount + calc.amount)
      acc.total_tax = round2(acc.total_tax + calc.tax_amount)
      acc.total_amount_with_tax = round2(acc.total_amount_with_tax + calc.total_amount)
      return acc
    }, { total_amount: 0, total_tax: 0, total_amount_with_tax: 0 })
  }, [items])

  // 物料明细操作
  const handleAddItem = () => {
    setItems([...items, {
      key: Date.now(),
      material_id: null,
      quantity: 1,
      unit_price: 0,
      tax_rate: 13,
      amount: 0,
      tax_amount: 0,
      total_amount: 0,
    }])
  }

  const handleDeleteItem = (key) => {
    setItems(items.filter((item) => item.key !== key))
  }

  const handleItemChange = (key, field, value) => {
    setItems(items.map((item) => {
      if (item.key !== key) return item
      const updated = { ...item, [field]: value }
      // 选择物料时自动带出物料信息
      if (field === 'material_id' && value) {
        const mat = materials.find((m) => m.id === value)
        if (mat) {
          updated.material_name = mat.name
          updated.material_code = mat.code
          updated.specification = mat.specification
          updated.unit = mat.unit
          // 自动带出标准单价
          if (mat.standard_price) {
            updated.unit_price = Number(mat.standard_price)
          }
          // 自动带出税率
          if (mat.tax_rate) {
            updated.tax_rate = Number(mat.tax_rate)
          }
        }
      }
      // 数量、单价、税率变化时重新计算金额
      if (field === 'quantity' || field === 'unit_price' || field === 'tax_rate') {
        const calc = calcRowAmount(updated)
        updated.amount = calc.amount
        updated.tax_amount = calc.tax_amount
        updated.total_amount = calc.total_amount
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
      department_id: values.department_id,
      buyer_id: values.buyer_id,
      expected_date: values.expected_date ? values.expected_date.format('YYYY-MM-DD') : null,
      payment_terms: values.payment_terms || '',
      delivery_address: values.delivery_address || '',
      reason: values.reason || '',
      source_bill_no: values.source_bill_no || (sourceBillNo || ''),
      total_amount: totals.total_amount,
      total_tax: totals.total_tax,
      total_amount_with_tax: totals.total_amount_with_tax,
      items: items
        .filter((item) => item.material_id)
        .map((item) => {
          const calc = calcRowAmount(item)
          return {
            id: item.id,
            material_id: item.material_id,
            quantity: Number(item.quantity) || 0,
            unit_price: Number(item.unit_price) || 0,
            tax_rate: Number(item.tax_rate) || 0,
            amount: calc.amount,
            tax_amount: calc.tax_amount,
            total_amount: calc.total_amount,
            remark: item.remark || '',
          }
        }),
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
      if (!item.quantity || Number(item.quantity) <= 0) {
        message.warning('物料数量必须大于0')
        return false
      }
      if (item.unit_price === undefined || item.unit_price === null || Number(item.unit_price) < 0) {
        message.warning('单价不能为空')
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
        const res = await purchaseOrderApi.create(data)
        message.success('保存成功')
        navigate(`/purchase/orders/${res.id}`)
      } else {
        await purchaseOrderApi.update(id, data)
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

  // 审核
  const handleAudit = () => {
    confirmAudit(record.bill_no, async () => {
      try {
        await purchaseOrderApi.audit(id)
        message.success('审核成功')
        loadRecord()
      } catch (e) {
        message.error(e.message || '审核失败')
      }
    })
  }

  // 下推生成入库单
  const handlePushDown = () => {
    navigate(`/purchase/receipts/new?source_bill_no=${record.bill_no}&source_bill_id=${record.id}`)
  }

  const itemColumns = [
    {
      title: '序号',
      width: 50,
      render: (_, __, idx) => idx + 1,
    },
    {
      title: '物料',
      dataIndex: 'material_id',
      key: 'material_id',
      width: 200,
      render: (_, record) => {
        if (isReadOnly) return <Text>{record.material_code} - {record.material_name}</Text>
        return (
          <Select
            showSearch
            placeholder="请选择物料"
            value={record.material_id}
            style={{ width: '100%' }}
            optionFilterProp="label"
            options={materials.map((m) => ({
              value: m.id,
              label: `${m.code} - ${m.name}`,
            }))}
            onChange={(val) => handleItemChange(record.key, 'material_id', val)}
          />
        )
      },
    },
    {
      title: '规格型号',
      dataIndex: 'specification',
      key: 'specification',
      width: 120,
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
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      render: (val, record) => {
        if (isReadOnly) return <Text>{val}</Text>
        return (
          <InputNumber
            value={val}
            min={0}
            precision={2}
            style={{ width: '100%' }}
            onChange={(v) => handleItemChange(record.key, 'quantity', v)}
          />
        )
      },
    },
    {
      title: '单价',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 110,
      render: (val, record) => {
        if (isReadOnly) return <Text>{formatMoney(val)}</Text>
        return (
          <InputNumber
            value={val}
            min={0}
            precision={2}
            style={{ width: '100%' }}
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => value.replace(/[^\d.]/g, '')}
            onChange={(v) => handleItemChange(record.key, 'unit_price', v)}
          />
        )
      },
    },
    {
      title: '税率(%)',
      dataIndex: 'tax_rate',
      key: 'tax_rate',
      width: 90,
      render: (val, record) => {
        if (isReadOnly) return <Text>{val}%</Text>
        return (
          <InputNumber
            value={val}
            min={0}
            max={100}
            precision={0}
            style={{ width: '100%' }}
            onChange={(v) => handleItemChange(record.key, 'tax_rate', v)}
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
      render: (val) => formatMoney(val),
    },
    {
      title: '税额',
      dataIndex: 'tax_amount',
      key: 'tax_amount',
      width: 110,
      align: 'right',
      render: (val) => formatMoney(val),
    },
    {
      title: '价税合计',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 130,
      align: 'right',
      render: (val) => <Text strong>{formatMoney(val)}</Text>,
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
      <div className="page-purchase-order-detail">
        {/* 头部 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space>
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate('/purchase/orders')}
                >
                  返回
                </Button>
                <Title level={4} style={{ margin: 0 }}>
                  采购订单
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
                {status === 'audited' && (
                  <Button
                    type="primary"
                    icon={<DownOutlined />}
                    className="btn-push-down"
                    onClick={handlePushDown}
                  >
                    下推生成入库单
                  </Button>
                )}
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 来源单据信息 */}
        {(record?.source_bill_no || sourceBillNo) && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space>
              <LinkOutlined />
              <Text>来源单据：</Text>
              <Text strong>{record?.source_bill_no || sourceBillNo}</Text>
              {sourceBillId && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => navigate(`/purchase/requests/${sourceBillId}`)}
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
                    showSearch
                    placeholder="请选择供应商"
                    disabled={isReadOnly}
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
                <Form.Item
                  label="申请部门"
                  name="department_id"
                  rules={[{ required: true, message: '请选择部门' }]}
                >
                  <Select
                    placeholder="请选择部门"
                    disabled={isReadOnly}
                    options={departments.map((d) => ({
                      value: d.id,
                      label: d.name,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  label="采购员"
                  name="buyer_id"
                  rules={[{ required: true, message: '请选择采购员' }]}
                >
                  <Select
                    placeholder="请选择采购员"
                    disabled={isReadOnly}
                    options={users.map((u) => ({
                      value: u.id,
                      label: u.real_name || u.username,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  label="预计交货日期"
                  name="expected_date"
                  rules={[{ required: true, message: '请选择预计交货日期' }]}
                >
                  <DatePicker style={{ width: '100%' }} disabled={isReadOnly} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="付款条件" name="payment_terms">
                  <Input placeholder="如：月结30天" disabled={isReadOnly} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="交货地址" name="delivery_address">
                  <Input placeholder="请输入交货地址" disabled={isReadOnly} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="来源单据" name="source_bill_no">
                  <Input placeholder="下推时自动填入" disabled />
                </Form.Item>
              </Col>
              <Col span={18}>
                <Form.Item label="备注" name="reason">
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
            !isReadOnly && (
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
            scroll={{ x: 1200 }}
          />
        </Card>

        {/* 金额合计 */}
        <Card title="金额合计" size="small">
          <Row gutter={48}>
            <Col span={8}>
              <Statistic
                title="不含税金额"
                value={totals.total_amount}
                precision={2}
                prefix="¥"
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="税额合计"
                value={totals.total_tax}
                precision={2}
                prefix="¥"
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="价税合计"
                value={totals.total_amount_with_tax}
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

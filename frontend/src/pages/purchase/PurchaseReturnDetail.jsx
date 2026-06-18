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
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  purchaseReturnApi,
  purchaseReceiptApi,
  supplierApi,
  warehouseApi,
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

export default function PurchaseReturnDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isNew = !id || id === 'new'
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

  // 加载已有数据
  const loadRecord = useCallback(async () => {
    if (isNew) {
      form.setFieldsValue({
        bill_date: dayjs(),
        operator_id: currentUser?.id,
      })
      setItems([{ key: Date.now(), material_id: null, return_quantity: 1, unit_price: 0, amount: 0 }])
      return
    }
    setLoading(true)
    try {
      const res = await purchaseReturnApi.get(id)
      setRecord(res)
      form.setFieldsValue({
        bill_no: res.bill_no,
        bill_date: res.bill_date ? dayjs(res.bill_date) : null,
        supplier_id: res.supplier_id,
        receipt_no: res.receipt_no,
        receipt_id: res.receipt_id,
        warehouse_id: res.warehouse_id,
        operator_id: res.operator_id,
        return_reason: res.return_reason,
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
        return_quantity: Number(item.return_quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
        amount: Number(item.amount) || 0,
      }))
      setItems(loadedItems.length > 0 ? loadedItems : [{ key: Date.now(), material_id: null, return_quantity: 1, unit_price: 0, amount: 0 }])
    } catch (e) {
      message.error(e.message || '加载数据失败')
    } finally {
      setLoading(false)
    }
  }, [id, isNew, form, currentUser])

  useEffect(() => {
    loadRecord()
  }, [loadRecord])

  const status = record?.status
  const isReadOnly = status === 'submitted' || status === 'audited'

  // 行金额计算
  const calcRowAmount = (item) => {
    const returnQty = Number(item.return_quantity) || 0
    const unitPrice = Number(item.unit_price) || 0
    return round2(returnQty * unitPrice)
  }

  // 合计
  const totals = useMemo(() => {
    return items.reduce((acc, item) => {
      acc.total_quantity = round2(acc.total_quantity + (Number(item.return_quantity) || 0))
      acc.total_amount = round2(acc.total_amount + calcRowAmount(item))
      return acc
    }, { total_quantity: 0, total_amount: 0 })
  }, [items])

  // 物料明细操作
  const handleAddItem = () => {
    setItems([...items, {
      key: Date.now(),
      material_id: null,
      return_quantity: 1,
      unit_price: 0,
      amount: 0,
    }])
  }

  const handleDeleteItem = (key) => {
    setItems(items.filter((item) => item.key !== key))
  }

  const handleItemChange = (key, field, value) => {
    setItems(items.map((item) => {
      if (item.key !== key) return item
      const updated = { ...item, [field]: value }
      // 退货数量或单价变化时重新计算金额
      if (field === 'return_quantity' || field === 'unit_price') {
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
      receipt_no: values.receipt_no || '',
      receipt_id: values.receipt_id,
      warehouse_id: values.warehouse_id,
      operator_id: values.operator_id,
      return_reason: values.return_reason || '',
      remark: values.remark || '',
      total_quantity: totals.total_quantity,
      total_amount: totals.total_amount,
      items: items
        .filter((item) => item.material_id)
        .map((item) => ({
          id: item.id,
          material_id: item.material_id,
          return_quantity: Number(item.return_quantity) || 0,
          unit_price: Number(item.unit_price) || 0,
          amount: calcRowAmount(item),
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
      message.warning('请至少添加一条退货物料')
      return false
    }
    for (const item of validItems) {
      if (Number(item.return_quantity) <= 0) {
        message.warning('退货数量必须大于0')
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
        const res = await purchaseReturnApi.create(data)
        message.success('保存成功')
        navigate(`/purchase/returns/${res.id}`)
      } else {
        await purchaseReturnApi.update(id, data)
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
        await purchaseReturnApi.audit(id)
        message.success('审核成功，库存已扣减，应付已调整')
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
      width: 200,
      render: (val, row) => {
        if (isReadOnly) return <Text>{row.material_code || '-'}</Text>
        return <Text>{row.material_code || '-'}</Text>
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
      title: '退货数量',
      dataIndex: 'return_quantity',
      key: 'return_quantity',
      width: 110,
      render: (val, row) => {
        if (isReadOnly) return <Text>{val}</Text>
        return (
          <InputNumber
            value={val}
            min={0}
            precision={2}
            style={{ width: '100%' }}
            onChange={(v) => handleItemChange(row.key, 'return_quantity', v)}
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
      render: (val, row) => {
        if (isReadOnly) return <Text>{formatMoney(val)}</Text>
        return (
          <InputNumber
            value={val}
            min={0}
            precision={2}
            style={{ width: '100%' }}
            onChange={(v) => handleItemChange(row.key, 'unit_price', v)}
          />
        )
      },
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      align: 'right',
      render: (val) => <Text strong>{formatMoney(val)}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 60,
      render: (_, row) => {
        if (isReadOnly) return null
        return (
          <Button
            type="link"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteItem(row.key)}
          />
        )
      },
    },
  ]

  return (
    <Spin spinning={loading}>
      <div className="page-purchase-return-detail">
        {/* 头部 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space>
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate('/purchase/returns')}
                >
                  返回
                </Button>
                <Title level={4} style={{ margin: 0 }}>
                  采购退货单
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
        {record?.receipt_no && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space>
              <LinkOutlined />
              <Text>源入库单：</Text>
              <Text strong>{record.receipt_no}</Text>
              {record.receipt_id && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => navigate(`/purchase/receipts/${record.receipt_id}`)}
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
                <Form.Item label="源入库单" name="receipt_no">
                  <Input placeholder="关联的入库单号" disabled />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  label="退货仓库"
                  name="warehouse_id"
                  rules={[{ required: true, message: '请选择退货仓库' }]}
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
                <Form.Item label="经办人" name="operator_id">
                  <Select
                    placeholder="请选择经办人"
                    disabled={isReadOnly}
                    options={users.map((u) => ({
                      value: u.id,
                      label: u.real_name || u.username,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="退货原因"
                  name="return_reason"
                  rules={[{ required: true, message: '请输入退货原因' }]}
                >
                  <Input.TextArea
                    rows={1}
                    placeholder="请输入退货原因"
                    disabled={isReadOnly}
                    maxLength={500}
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
          title="退货明细"
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
            scroll={{ x: 1000 }}
          />
        </Card>

        {/* 合计 */}
        <Card title="合计" size="small">
          <Row gutter={48}>
            <Col span={12}>
              <Statistic
                title="退货数量合计"
                value={totals.total_quantity}
                precision={2}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="退货金额合计"
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

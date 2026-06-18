import React, { useEffect, useState, useCallback } from 'react'
import {
  Card, Form, Input, Select, DatePicker, Button, Space, Table, InputNumber,
  message, Row, Col, Statistic, Divider, Typography,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, SaveOutlined, CheckOutlined,
  AuditOutlined, ArrowLeftOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { salesOrderApi, customerApi, materialApi } from '../../api'
import { formatMoney, confirmAudit } from '../../components/CrudHelpers'
import BillStatus from '../../components/BillStatus'

const { Title } = Typography

export default function SalesOrderDetail() {
  const navigate = useNavigate()
  const params = useParams()
  const isEdit = !!params.id

  const [form] = Form.useForm()
  const [customers, setCustomers] = useState([])
  const [materials, setMaterials] = useState([])
  const [orderItems, setOrderItems] = useState([])
  const [billStatus, setBillStatus] = useState('draft')
  const [billNo, setBillNo] = useState('')
  const [loading, setLoading] = useState(false)

  // 合计
  const [totalAmount, setTotalAmount] = useState(0)
  const [totalTax, setTotalTax] = useState(0)
  const [totalWithTax, setTotalWithTax] = useState(0)

  useEffect(() => {
    customerApi.list().then((res) => {
      setCustomers(res.items || res || [])
    }).catch(console.error)
    materialApi.list().then((res) => {
      setMaterials(res.items || res || [])
    }).catch(console.error)
  }, [])

  // 生成单号
  const generateBillNo = () => {
    const now = dayjs()
    return `SO${now.format('YYYYMMDD')}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
  }

  useEffect(() => {
    if (isEdit) {
      setLoading(true)
      salesOrderApi.get(params.id).then((detail) => {
        form.setFieldsValue({
          bill_no: detail.bill_no,
          bill_date: detail.bill_date ? dayjs(detail.bill_date) : undefined,
          customer_id: detail.customer_id,
          salesperson: detail.salesperson,
          payment_terms: detail.payment_terms,
          expected_delivery_date: detail.expected_delivery_date ? dayjs(detail.expected_delivery_date) : undefined,
          delivery_address: detail.delivery_address,
          remark: detail.remark,
        })
        setBillNo(detail.bill_no)
        setBillStatus(detail.status)
        setOrderItems((detail.items || []).map((item, idx) => ({
          key: Date.now() + idx,
          material_id: item.material_id,
          material_code: item.material_code,
          material_name: item.material_name,
          specification: item.specification,
          unit: item.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          amount: item.amount,
          tax_amount: item.tax_amount,
          total: item.total,
        })))
      }).catch((e) => {
        message.error(e.message || '加载销售订单失败')
      }).finally(() => setLoading(false))
    } else {
      const initialBillNo = generateBillNo()
      form.setFieldsValue({
        bill_no: initialBillNo,
        bill_date: dayjs(),
        payment_terms: '30天',
        tax_rate: 13,
      })
      setBillNo(initialBillNo)
    }
  }, [isEdit, params.id])

  // 重新计算每行金额和合计
  const recalcItems = useCallback((items) => {
    return items.map((item) => {
      const quantity = Number(item.quantity) || 0
      const unitPrice = Number(item.unit_price) || 0
      const taxRate = Number(item.tax_rate) || 0
      const amount = Math.round(quantity * unitPrice * 100) / 100
      const taxAmount = Math.round(amount * taxRate / 100 * 100) / 100
      const total = Math.round((amount + taxAmount) * 100) / 100
      return { ...item, amount, tax_amount: taxAmount, total }
    })
  }, [])

  // 合计
  useEffect(() => {
    const calc = recalcItems(orderItems)
    const amt = calc.reduce((s, item) => s + (Number(item.amount) || 0), 0)
    const tax = calc.reduce((s, item) => s + (Number(item.tax_amount) || 0), 0)
    const total = calc.reduce((s, item) => s + (Number(item.total) || 0), 0)
    setTotalAmount(Math.round(amt * 100) / 100)
    setTotalTax(Math.round(tax * 100) / 100)
    setTotalWithTax(Math.round(total * 100) / 100)
  }, [orderItems, recalcItems])

  // 添加明细行
  const handleAddItem = () => {
    setOrderItems([...orderItems, {
      key: Date.now(),
      material_id: undefined,
      material_code: '',
      material_name: '',
      specification: '',
      unit: '',
      quantity: 0,
      unit_price: 0,
      tax_rate: 13,
      amount: 0,
      tax_amount: 0,
      total: 0,
    }])
  }

  // 选择物料
  const handleMaterialChange = (key, materialId) => {
    const material = materials.find((m) => m.id === materialId)
    if (!material) return
    setOrderItems(orderItems.map((item) => {
      if (item.key === key) {
        return {
          ...item,
          material_id: material.id,
          material_code: material.code,
          material_name: material.name,
          specification: material.specification,
          unit: material.unit,
          unit_price: material.standard_price || 0,
          tax_rate: material.tax_rate || 13,
        }
      }
      return item
    }))
  }

  // 修改明细字段
  const handleItemChange = (key, field, value) => {
    setOrderItems(orderItems.map((item) => {
      if (item.key === key) {
        return { ...item, [field]: value }
      }
      return item
    }))
  }

  // 删除明细行
  const handleRemoveItem = (key) => {
    setOrderItems(orderItems.filter((item) => item.key !== key))
  }

  // 保存/提交
  const handleSave = async (submit = false) => {
    try {
      const values = await form.validateFields()
      if (orderItems.length === 0) {
        message.warning('请至少添加一条订单明细')
        return
      }

      // 验证明细
      for (const item of orderItems) {
        if (!item.material_id) {
          message.warning('请选择所有明细行的物料')
          return
        }
        if (!item.quantity || item.quantity <= 0) {
          message.warning('数量必须大于0')
          return
        }
      }

      const payload = {
        ...values,
        bill_date: values.bill_date ? values.bill_date.format('YYYY-MM-DD') : undefined,
        expected_delivery_date: values.expected_delivery_date ? values.expected_delivery_date.format('YYYY-MM-DD') : undefined,
        items: recalcItems(orderItems).map((item) => ({
          material_id: item.material_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          amount: item.amount,
          tax_amount: item.tax_amount,
          total: item.total,
        })),
        total_amount: totalAmount,
        total_tax: totalTax,
        total_amount_with_tax: totalWithTax,
        status: submit ? 'submitted' : 'draft',
      }

      if (isEdit) {
        if (submit) {
          await salesOrderApi.create(payload)
          message.success('销售订单已提交')
        }
      } else {
        await salesOrderApi.create(payload)
        message.success(submit ? '销售订单已提交' : '销售订单保存成功')
      }
      navigate('/sales/orders')
    } catch (e) {
      if (e.errorFields) return
      message.error(e.message || '保存失败')
    }
  }

  // 审核
  const handleAudit = () => {
    confirmAudit(billNo, async () => {
      try {
        await salesOrderApi.audit(params.id)
        message.success('审核成功')
        navigate('/sales/orders')
      } catch (e) {
        message.error(e.message || '审核失败')
      }
    })
  }

  const isReadonly = billStatus === 'audited'

  const columns = [
    {
      title: '物料',
      dataIndex: 'material_id',
      key: 'material_id',
      width: 200,
      render: (v, record) => (
        <Select
          value={v}
          placeholder="请选择物料"
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          disabled={isReadonly}
          options={materials.map((m) => ({
            label: `${m.code} - ${m.name}`,
            value: m.id,
          }))}
          onChange={(val) => handleMaterialChange(record.key, val)}
        />
      ),
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
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'right',
      render: (v, record) => (
        <InputNumber
          value={v}
          min={0}
          precision={2}
          style={{ width: '100%' }}
          disabled={isReadonly}
          onChange={(val) => handleItemChange(record.key, 'quantity', val)}
        />
      ),
    },
    {
      title: '单价',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 120,
      align: 'right',
      render: (v, record) => (
        <InputNumber
          value={v}
          min={0}
          precision={2}
          style={{ width: '100%' }}
          disabled={isReadonly}
          onChange={(val) => handleItemChange(record.key, 'unit_price', val)}
        />
      ),
    },
    {
      title: '税率(%)',
      dataIndex: 'tax_rate',
      key: 'tax_rate',
      width: 90,
      align: 'right',
      render: (v, record) => (
        <InputNumber
          value={v}
          min={0}
          max={100}
          precision={0}
          style={{ width: '100%' }}
          disabled={isReadonly}
          onChange={(val) => handleItemChange(record.key, 'tax_rate', val)}
        />
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right',
      render: (v) => formatMoney(v),
    },
    {
      title: '税额',
      dataIndex: 'tax_amount',
      key: 'tax_amount',
      width: 120,
      align: 'right',
      render: (v) => formatMoney(v),
    },
    {
      title: '价税合计',
      dataIndex: 'total',
      key: 'total',
      width: 130,
      align: 'right',
      render: (v) => <span style={{ fontWeight: 600 }}>{formatMoney(v)}</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: 60,
      render: (_, record) =>
        !isReadonly ? (
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleRemoveItem(record.key)}
          />
        ) : null,
    },
  ]

  return (
    <div>
      <Card
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/sales/orders')}
            />
            <span>{isEdit ? '销售订单详情' : '新建销售订单'}</span>
            {isEdit && <BillStatus status={billStatus} />}
          </Space>
        }
        loading={loading}
      >
        <Form
          form={form}
          layout="vertical"
          disabled={isReadonly}
        >
          <Row gutter={24}>
            <Col span={6}>
              <Form.Item
                name="bill_no"
                label="订单编号"
                rules={[{ required: true, message: '请输入订单编号' }]}
              >
                <Input placeholder="自动生成" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="bill_date"
                label="订单日期"
                rules={[{ required: true, message: '请选择订单日期' }]}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="customer_id"
                label="客户"
                rules={[{ required: true, message: '请选择客户' }]}
              >
                <Select
                  placeholder="请选择客户"
                  showSearch
                  optionFilterProp="label"
                  options={customers.map((c) => ({
                    label: c.name,
                    value: c.id,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="salesperson" label="销售员">
                <Input placeholder="请输入销售员" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={6}>
              <Form.Item name="payment_terms" label="付款条件">
                <Input placeholder="如：30天" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="expected_delivery_date" label="预计交货日期">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="delivery_address" label="交货地址">
                <Input placeholder="请输入交货地址" />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <Divider>订单明细</Divider>

        {!isReadonly && (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleAddItem}
            style={{ marginBottom: 16 }}
            className="btn-add-sales-order-item"
          >
            添加明细行
          </Button>
        )}

        <Table
          className="sales-order-items-table"
          columns={columns}
          dataSource={orderItems}
          rowKey="key"
          pagination={false}
          size="small"
          scroll={{ x: 1100 }}
        />

        {/* 合计 */}
        <Row gutter={16} style={{ marginTop: 24 }}>
          <Col span={6} offset={6}>
            <Card size="small">
              <Statistic
                title="不含税金额"
                value={totalAmount}
                precision={2}
                prefix="¥"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="税额合计"
                value={totalTax}
                precision={2}
                prefix="¥"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="价税合计"
                value={totalWithTax}
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#1677ff', fontSize: 24 }}
              />
            </Card>
          </Col>
        </Row>

        {/* 操作按钮 */}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Space size="large">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/sales/orders')}
            >
              返回列表
            </Button>
            {!isReadonly && !isEdit && (
              <Button
                icon={<SaveOutlined />}
                onClick={() => handleSave(false)}
                className="btn-save-sales-order"
              >
                保存草稿
              </Button>
            )}
            {!isReadonly && (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => handleSave(true)}
                className="btn-submit-sales-order"
              >
                提交
              </Button>
            )}
            {isEdit && billStatus === 'submitted' && (
              <Button
                type="primary"
                danger
                icon={<AuditOutlined />}
                onClick={handleAudit}
                className="btn-audit-sales-order"
              >
                审核
              </Button>
            )}
          </Space>
        </div>
      </Card>
    </div>
  )
}

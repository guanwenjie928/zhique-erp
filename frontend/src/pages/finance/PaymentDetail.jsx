import React, { useEffect, useState, useCallback } from 'react'
import {
  Card, Form, Input, Select, DatePicker, Button, Space, Table, InputNumber,
  message, Row, Col, Statistic, Divider, Typography,
} from 'antd'
import {
  SaveOutlined, CheckOutlined, AuditOutlined, ArrowLeftOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import dayjs from 'dayjs'
import { paymentApi, payableApi, supplierApi } from '../../api'
import { formatMoney, formatDate, confirmAudit } from '../../components/CrudHelpers'
import BillStatus from '../../components/BillStatus'

const { Title } = Typography

export default function PaymentDetail() {
  const navigate = useNavigate()
  const params = useParams()
  const location = useLocation()
  const isEdit = !!params.id
  const locationState = location.state

  const [form] = Form.useForm()
  const [suppliers, setSuppliers] = useState([])
  const [payables, setPayables] = useState([])
  const [payablesLoading, setPayablesLoading] = useState(false)
  const [paymentItems, setPaymentItems] = useState([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [billStatus, setBillStatus] = useState('draft')
  const [billNo, setBillNo] = useState('')

  // 加载供应商
  useEffect(() => {
    supplierApi.list().then((res) => {
      setSuppliers(res.items || res || [])
    }).catch(console.error)
  }, [])

  // 生成单号
  const generateBillNo = () => {
    const now = dayjs()
    return `FK${now.format('YYYYMMDD')}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
  }

  // 初始化
  useEffect(() => {
    if (isEdit) {
      // 编辑模式 - 加载付款单数据
      setLoading(true)
      paymentApi.get(params.id).then((detail) => {
        form.setFieldsValue({
          bill_no: detail.bill_no,
          bill_date: detail.bill_date ? dayjs(detail.bill_date) : undefined,
          supplier_id: detail.supplier_id,
          payment_method: detail.payment_method,
          bank_account: detail.bank_account,
          remark: detail.remark,
        })
        setBillNo(detail.bill_no)
        setBillStatus(detail.status)
        setPaymentItems(detail.items || [])
        if (detail.supplier_id) {
          loadPayables(detail.supplier_id)
        }
      }).catch((e) => {
        message.error(e.message || '加载付款单失败')
      }).finally(() => setLoading(false))
    } else {
      // 新建模式
      const initialBillNo = generateBillNo()
      form.setFieldsValue({
        bill_no: initialBillNo,
        bill_date: dayjs(),
        payment_method: 'bank',
        bank_account: '',
        remark: '',
      })
      setBillNo(initialBillNo)

      // 如果从应付账款跳转过来，预填供应商
      if (locationState?.supplier_id) {
        form.setFieldsValue({ supplier_id: locationState.supplier_id })
        loadPayables(locationState.supplier_id)
      }
    }
  }, [isEdit, params.id])

  // 加载供应商的应付账款
  const loadPayables = useCallback((supplierId) => {
    if (!supplierId) {
      setPayables([])
      return
    }
    setPayablesLoading(true)
    payableApi.list({ supplier_id: supplierId, status: 'unpaid' }).then((res) => {
      const items = (res.items || res || []).filter((p) =>
        p.status === 'unpaid' || p.status === 'partial'
      )
      setPayables(items)

      // 如果从应付跳转过来，自动添加核销项
      if (locationState?.payable_id && !isEdit) {
        const targetPayable = items.find((p) => p.id === locationState.payable_id)
        if (targetPayable) {
          const newItem = {
            key: Date.now(),
            payable_id: targetPayable.id,
            payable_bill_no: targetPayable.bill_no,
            payable_amount: targetPayable.balance || targetPayable.amount,
            this_payment: targetPayable.balance || targetPayable.amount,
          }
          setPaymentItems([newItem])
        }
      }
    }).catch(console.error).finally(() => setPayablesLoading(false))
  }, [locationState, isEdit])

  // 计算总金额
  useEffect(() => {
    const sum = paymentItems.reduce((s, item) => s + (Number(item.this_payment) || 0), 0)
    setTotalAmount(sum)
  }, [paymentItems])

  const handleSupplierChange = (supplierId) => {
    setPaymentItems([])
    loadPayables(supplierId)
  }

  // 添加核销项
  const handleAddPayable = (payableId) => {
    const payable = payables.find((p) => p.id === payableId)
    if (!payable) return
    // 检查是否已添加
    if (paymentItems.some((item) => item.payable_id === payableId)) {
      message.warning('该应付账款已添加')
      return
    }
    const newItem = {
      key: Date.now(),
      payable_id: payable.id,
      payable_bill_no: payable.bill_no,
      payable_amount: payable.balance || payable.amount,
      this_payment: payable.balance || payable.amount,
    }
    setPaymentItems([...paymentItems, newItem])
  }

  // 修改本次付款金额
  const handlePaymentChange = (key, value) => {
    setPaymentItems(paymentItems.map((item) => {
      if (item.key === key) {
        return { ...item, this_payment: value }
      }
      return item
    }))
  }

  // 删除核销项
  const handleRemoveItem = (key) => {
    setPaymentItems(paymentItems.filter((item) => item.key !== key))
  }

  // 保存
  const handleSave = async (submit = false) => {
    try {
      const values = await form.validateFields()
      const payload = {
        ...values,
        bill_date: values.bill_date ? values.bill_date.format('YYYY-MM-DD') : undefined,
        items: paymentItems.map((item) => ({
          payable_id: item.payable_id,
          payable_bill_no: item.payable_bill_no,
          payable_amount: item.payable_amount,
          this_payment: Number(item.this_payment) || 0,
        })),
        total_amount: totalAmount,
        status: submit ? 'submitted' : 'draft',
      }

      if (isEdit) {
        // 已存在单据 - 仅提交
        if (submit) {
          await paymentApi.create(payload)
          message.success('付款单已提交')
        } else {
          message.info('已有付款单不支持重复保存')
          return
        }
      } else {
        await paymentApi.create(payload)
        message.success(submit ? '付款单已提交' : '付款单保存成功')
      }
      navigate('/finance/payments')
    } catch (e) {
      if (e.errorFields) return
      message.error(e.message || '保存失败')
    }
  }

  // 审核
  const handleAudit = () => {
    confirmAudit(billNo, async () => {
      try {
        await paymentApi.audit(params.id)
        message.success('审核成功')
        navigate('/finance/payments')
      } catch (e) {
        message.error(e.message || '审核失败')
      }
    })
  }

  const itemColumns = [
    {
      title: '应付单号',
      dataIndex: 'payable_bill_no',
      key: 'payable_bill_no',
      width: 180,
    },
    {
      title: '应付金额',
      dataIndex: 'payable_amount',
      key: 'payable_amount',
      width: 130,
      align: 'right',
      render: (v) => formatMoney(v),
    },
    {
      title: '本次付款',
      dataIndex: 'this_payment',
      key: 'this_payment',
      width: 160,
      align: 'right',
      render: (v, record) => (
        <InputNumber
          value={v}
          min={0}
          max={record.payable_amount}
          precision={2}
          style={{ width: '100%' }}
          onChange={(val) => handlePaymentChange(record.key, val)}
          disabled={billStatus === 'audited'}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        billStatus !== 'audited' ? (
          <Button
            type="link"
            size="small"
            danger
            onClick={() => handleRemoveItem(record.key)}
          >
            删除
          </Button>
        ) : null
      ),
    },
  ]

  const isReadonly = billStatus === 'audited'

  return (
    <div>
      <Card
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/finance/payments')}
            />
            <span>{isEdit ? '付款单详情' : '新建付款单'}</span>
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
                label="付款单号"
                rules={[{ required: true, message: '请输入付款单号' }]}
              >
                <Input placeholder="自动生成" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="bill_date"
                label="付款日期"
                rules={[{ required: true, message: '请选择付款日期' }]}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="supplier_id"
                label="供应商"
                rules={[{ required: true, message: '请选择供应商' }]}
              >
                <Select
                  placeholder="请选择供应商"
                  showSearch
                  optionFilterProp="label"
                  options={suppliers.map((s) => ({
                    label: s.name,
                    value: s.id,
                  }))}
                  onChange={handleSupplierChange}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="payment_method"
                label="付款方式"
                rules={[{ required: true, message: '请选择付款方式' }]}
              >
                <Select
                  placeholder="请选择付款方式"
                  options={[
                    { label: '银行转账', value: 'bank' },
                    { label: '现金', value: 'cash' },
                    { label: '支票', value: 'check' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="bank_account" label="银行账号">
                <Input placeholder="请输入银行账号（如适用）" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={1} placeholder="请输入备注" />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <Divider>核销明细</Divider>

        {!isReadonly && (
          <Space style={{ marginBottom: 16 }}>
            <Select
              placeholder="选择应付账款进行核销"
              style={{ width: 400 }}
              showSearch
              optionFilterProp="label"
              loading={payablesLoading}
              options={payables.map((p) => ({
                label: `${p.bill_no} - 余额 ${formatMoney(p.balance || p.amount)}`,
                value: p.id,
              }))}
              onChange={handleAddPayable}
              value={undefined}
              allowClear
            />
          </Space>
        )}

        <Table
          className="payment-items-table"
          columns={itemColumns}
          dataSource={paymentItems}
          rowKey="key"
          pagination={false}
          size="small"
          loading={payablesLoading}
          locale={{ emptyText: '请添加需要核销的应付账款' }}
        />

        {/* 合计 */}
        <Row gutter={16} style={{ marginTop: 24 }}>
          <Col span={8} offset={12}>
            <Card size="small">
              <Statistic
                title="付款总金额"
                value={totalAmount}
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
              onClick={() => navigate('/finance/payments')}
            >
              返回列表
            </Button>
            {!isReadonly && !isEdit && (
              <Button
                type="default"
                icon={<SaveOutlined />}
                onClick={() => handleSave(false)}
                className="btn-save-payment"
              >
                保存草稿
              </Button>
            )}
            {!isReadonly && (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => handleSave(true)}
                className="btn-submit-payment"
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
                className="btn-audit-payment"
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

import React, { useState, useEffect, useCallback } from 'react'
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
} from 'antd'
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  CheckOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  purchaseRequestApi,
  materialApi,
  departmentApi,
  userApi,
} from '../../api'
import {
  confirmAudit,
  formatDate,
} from '../../components/CrudHelpers'
import BillStatus from '../../components/BillStatus'
import { useAppStore } from '../../stores/appStore'

const { Title, Text } = Typography

export default function PurchaseRequestDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [record, setRecord] = useState(null)
  const [items, setItems] = useState([])
  const [materials, setMaterials] = useState([])
  const [departments, setDepartments] = useState([])
  const [users, setUsers] = useState([])
  const currentUser = useAppStore((s) => s.currentUser)

  // 加载选项数据
  useEffect(() => {
    materialApi.list({ limit: 9999 }).then((res) => {
      setMaterials(res.items || res || [])
    }).catch(() => {})
    departmentApi.list().then((res) => {
      setDepartments(res.items || res || [])
    }).catch(() => {})
    userApi.list().then((res) => {
      setUsers(res.items || res || [])
    }).catch(() => {})
  }, [])

  // 加载已有数据
  const loadRecord = useCallback(async () => {
    if (isNew) {
      // 新建模式 - 初始化默认值
      const today = dayjs()
      form.setFieldsValue({
        bill_date: today,
        expected_date: today.add(7, 'day'),
        department_id: currentUser?.department_id,
        requester_id: currentUser?.id,
        reason: '',
      })
      setItems([{ key: Date.now(), material_id: null, quantity: 1, remark: '' }])
      return
    }
    setLoading(true)
    try {
      const res = await purchaseRequestApi.get(id)
      setRecord(res)
      form.setFieldsValue({
        bill_no: res.bill_no,
        bill_date: res.bill_date ? dayjs(res.bill_date) : null,
        department_id: res.department_id,
        requester_id: res.requester_id,
        expected_date: res.expected_date ? dayjs(res.expected_date) : null,
        reason: res.reason,
      })
      const loadedItems = (res.items || []).map((item, idx) => ({
        key: item.id || idx,
        id: item.id,
        material_id: item.material_id,
        material_name: item.material?.name,
        material_code: item.material?.code,
        specification: item.material?.specification,
        unit: item.material?.unit,
        quantity: item.quantity,
        remark: item.remark,
      }))
      setItems(loadedItems.length > 0 ? loadedItems : [{ key: Date.now(), material_id: null, quantity: 1, remark: '' }])
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
  const isReadOnly = status === 'submitted' || status === 'audited' || status === 'linked'

  // 物料明细操作
  const handleAddItem = () => {
    setItems([...items, { key: Date.now(), material_id: null, quantity: 1, remark: '' }])
  }

  const handleDeleteItem = (key) => {
    setItems(items.filter((item) => item.key !== key))
  }

  const handleItemChange = (key, field, value) => {
    setItems(items.map((item) => {
      if (item.key === key) {
        const updated = { ...item, [field]: value }
        // 选择物料时自动带出物料信息
        if (field === 'material_id' && value) {
          const mat = materials.find((m) => m.id === value)
          if (mat) {
            updated.material_name = mat.name
            updated.material_code = mat.code
            updated.specification = mat.specification
            updated.unit = mat.unit
          }
        }
        return updated
      }
      return item
    }))
  }

  // 数量合计
  const totalQuantity = items.reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0)
  }, 0)

  // 收集表单数据
  const collectData = (submitAction = 'save') => {
    const values = form.getFieldsValue()
    const data = {
      bill_date: values.bill_date ? values.bill_date.format('YYYY-MM-DD') : null,
      department_id: values.department_id,
      requester_id: values.requester_id,
      expected_date: values.expected_date ? values.expected_date.format('YYYY-MM-DD') : null,
      reason: values.reason || '',
      items: items
        .filter((item) => item.material_id)
        .map((item) => ({
          id: item.id,
          material_id: item.material_id,
          quantity: Number(item.quantity) || 0,
          remark: item.remark || '',
        })),
    }
    if (submitAction === 'submit') {
      data.status = 'submitted'
    }
    return data
  }

  // 验证
  const validateItems = () => {
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
    }
    return true
  }

  // 保存
  const handleSave = async (submitAction = 'save') => {
    try {
      const values = await form.validateFields()
      if (!validateItems()) return

      setSaving(true)
      const data = collectData(submitAction)
      if (isNew) {
        const res = await purchaseRequestApi.create(data)
        message.success('保存成功')
        navigate(`/purchase/requests/${res.id}`)
      } else {
        await purchaseRequestApi.update(id, data)
        message.success('保存成功')
        loadRecord()
      }
    } catch (e) {
      if (e.errorFields) return // form validation error
      message.error(e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 审核
  const handleAudit = () => {
    confirmAudit(record.bill_no, async () => {
      try {
        await purchaseRequestApi.audit(id)
        message.success('审核成功')
        loadRecord()
      } catch (e) {
        message.error(e.message || '审核失败')
      }
    })
  }

  const itemColumns = [
    {
      title: '序号',
      width: 60,
      render: (_, __, idx) => idx + 1,
    },
    {
      title: '物料编码',
      dataIndex: 'material_id',
      key: 'material_id',
      width: 180,
      render: (_, record) => {
        if (isReadOnly) return <Text>{record.material_code || '-'}</Text>
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
      title: '物料名称',
      dataIndex: 'material_name',
      key: 'material_name',
      width: 150,
      render: (text) => text || '-',
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
      width: 80,
      render: (text) => text || '-',
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 120,
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
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      render: (val, record) => {
        if (isReadOnly) return <Text>{val || '-'}</Text>
        return (
          <Input
            value={val}
            placeholder="备注"
            onChange={(e) => handleItemChange(record.key, 'remark', e.target.value)}
          />
        )
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
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
      <div className="page-purchase-request-detail">
        {/* 头部 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space>
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate('/purchase/requests')}
                >
                  返回
                </Button>
                <Title level={4} style={{ margin: 0 }}>
                  采购申请单
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
                  label="申请部门"
                  name="department_id"
                  rules={[{ required: true, message: '请选择申请部门' }]}
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
                  label="申请人"
                  name="requester_id"
                  rules={[{ required: true, message: '请选择申请人' }]}
                >
                  <Select
                    placeholder="请选择申请人"
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
                  label="期望交货日期"
                  name="expected_date"
                  rules={[{ required: true, message: '请选择期望交货日期' }]}
                >
                  <DatePicker style={{ width: '100%' }} disabled={isReadOnly} />
                </Form.Item>
              </Col>
              <Col span={18}>
                <Form.Item label="申请原因" name="reason">
                  <Input.TextArea
                    rows={1}
                    placeholder="请输入申请原因"
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
            scroll={{ x: 900 }}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={5}>
                    <Text strong>合计</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>
                    <Text strong>{totalQuantity.toFixed(2)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} colSpan={2} />
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Card>
      </div>
    </Spin>
  )
}

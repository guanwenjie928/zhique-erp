import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Select,
  DatePicker,
  Row,
  Col,
  Form,
  Typography,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import {
  purchaseReturnApi,
  supplierApi,
} from '../../api'
import {
  useCrudPage,
  confirmAudit,
  confirmDelete,
  formatDate,
  formatMoney,
} from '../../components/CrudHelpers'
import BillStatus from '../../components/BillStatus'
import { message } from 'antd'

const { RangePicker } = DatePicker
const { Title } = Typography

const STATUS_OPTIONS = [
  { value: 'draft', label: '草稿' },
  { value: 'submitted', label: '已提交' },
  { value: 'audited', label: '已审核' },
]

export default function PurchaseReturnList() {
  const navigate = useNavigate()
  const [searchForm] = Form.useForm()
  const [suppliers, setSuppliers] = useState([])

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
    fetchData: purchaseReturnApi.list,
    initialSearch: {},
  })

  // 加载供应商选项
  useEffect(() => {
    supplierApi.list({ limit: 9999 }).then((res) => {
      setSuppliers(res.items || res || [])
    }).catch(() => {})
  }, [])

  const handleAudit = async (record) => {
    confirmAudit(record.bill_no, async () => {
      try {
        await purchaseReturnApi.audit(record.id)
        message.success('审核成功')
        loadData()
      } catch (e) {
        message.error(e.message || '审核失败')
      }
    })
  }

  const handleDelete = (record) => {
    confirmDelete(record.bill_no, async () => {
      try {
        await purchaseReturnApi.delete(record.id)
        message.success('删除成功')
        loadData()
      } catch (e) {
        message.error(e.message || '删除失败')
      }
    })
  }

  const columns = [
    {
      title: '单据编号',
      dataIndex: 'bill_no',
      key: 'bill_no',
      width: 160,
      fixed: 'left',
      render: (text, record) => (
        <a onClick={() => navigate(`/purchase/returns/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '单据日期',
      dataIndex: 'bill_date',
      key: 'bill_date',
      width: 120,
      render: (text) => formatDate(text),
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: 180,
      render: (text, record) => text || record.supplier?.name || '-',
    },
    {
      title: '源入库单',
      dataIndex: 'receipt_no',
      key: 'receipt_no',
      width: 160,
      render: (text, record) => text || record.receipt?.bill_no || '-',
    },
    {
      title: '退货仓库',
      dataIndex: 'warehouse_name',
      key: 'warehouse_name',
      width: 120,
      render: (text, record) => text || record.warehouse?.name || '-',
    },
    {
      title: '退货数量',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      width: 110,
      align: 'right',
      render: (val) => val ?? '-',
    },
    {
      title: '退货金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 130,
      align: 'right',
      render: (val) => formatMoney(val),
    },
    {
      title: '退货原因',
      dataIndex: 'return_reason',
      key: 'return_reason',
      width: 150,
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <BillStatus status={status} />,
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/purchase/returns/${record.id}`)}
            />
          </Tooltip>
          {record.status === 'submitted' && (
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              className="btn-audit"
              onClick={() => handleAudit(record)}
            >
              审核
            </Button>
          )}
          {record.status === 'draft' && (
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            >
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="page-purchase-return-list">
      <Card
        title={<Title level={4} style={{ margin: 0 }}>采购退货单</Title>}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            className="btn-create-return"
            onClick={() => navigate('/purchase/returns/new')}
          >
            新建
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
              <Form.Item name="bill_no" label="单据编号">
                <Input
                  placeholder="请输入单据编号"
                  allowClear
                  style={{ width: 180 }}
                />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item name="supplier_id" label="供应商">
                <Select
                  placeholder="全部供应商"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  style={{ width: 200 }}
                  options={suppliers.map((s) => ({
                    value: s.id,
                    label: s.name,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item name="status" label="状态">
                <Select
                  placeholder="全部状态"
                  allowClear
                  style={{ width: 140 }}
                  options={STATUS_OPTIONS}
                />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item name="date_range" label="日期范围">
                <RangePicker
                  style={{ width: 240 }}
                  onChange={(dates) => {
                    if (dates) {
                      searchForm.setFieldsValue({
                        start_date: dates[0]?.format('YYYY-MM-DD'),
                        end_date: dates[1]?.format('YYYY-MM-DD'),
                      })
                    } else {
                      searchForm.setFieldsValue({
                        start_date: undefined,
                        end_date: undefined,
                      })
                    }
                  }}
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
          scroll={{ x: 1500 }}
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
    </div>
  )
}

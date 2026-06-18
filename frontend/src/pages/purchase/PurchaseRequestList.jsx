import React, { useState } from 'react'
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
  DownOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  purchaseRequestApi,
  departmentApi,
  userApi,
} from '../../api'
import {
  useCrudPage,
  confirmAudit,
  confirmDelete,
  formatDate,
} from '../../components/CrudHelpers'
import BillStatus from '../../components/BillStatus'
import { message } from 'antd'

const { RangePicker } = DatePicker
const { Title } = Typography

const STATUS_OPTIONS = [
  { value: 'draft', label: '草稿' },
  { value: 'submitted', label: '已提交' },
  { value: 'audited', label: '已审核' },
  { value: 'linked', label: '已转单' },
]

export default function PurchaseRequestList() {
  const navigate = useNavigate()
  const [searchForm] = Form.useForm()
  const [departments, setDepartments] = useState([])
  const [users, setUsers] = useState([])

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
    fetchData: purchaseRequestApi.list,
    initialSearch: {},
  })

  // 加载部门和用户选项
  React.useEffect(() => {
    departmentApi.list().then((res) => {
      setDepartments(res.items || res || [])
    }).catch(() => {})
    userApi.list().then((res) => {
      setUsers(res.items || res || [])
    }).catch(() => {})
  }, [])

  const handleAudit = async (record) => {
    confirmAudit(record.bill_no, async () => {
      try {
        await purchaseRequestApi.audit(record.id)
        message.success('审核成功')
        loadData()
      } catch (e) {
        message.error(e.message || '审核失败')
      }
    })
  }

  const handlePushDown = (record) => {
    navigate(`/purchase/orders/new?source_bill_no=${record.bill_no}&source_bill_id=${record.id}`)
  }

  const handleDelete = (record) => {
    confirmDelete(record.bill_no, async () => {
      try {
        await purchaseRequestApi.delete(record.id)
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
        <a onClick={() => navigate(`/purchase/requests/${record.id}`)}>{text}</a>
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
      title: '申请部门',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 120,
      render: (text, record) => text || record.department?.name || '-',
    },
    {
      title: '申请人',
      dataIndex: 'requester_name',
      key: 'requester_name',
      width: 100,
      render: (text, record) => text || record.requester?.real_name || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <BillStatus status={status} />,
    },
    {
      title: '期望交货日期',
      dataIndex: 'expected_date',
      key: 'expected_date',
      width: 120,
      render: (text) => formatDate(text),
    },
    {
      title: '物料项数',
      dataIndex: 'item_count',
      key: 'item_count',
      width: 100,
      align: 'right',
      render: (val, record) => val ?? (record.items?.length || 0),
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
              onClick={() => navigate(`/purchase/requests/${record.id}`)}
            />
          </Tooltip>
          {record.status === 'submitted' && (
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleAudit(record)}
            >
              审核
            </Button>
          )}
          {record.status === 'audited' && (
            <Button
              type="link"
              size="small"
              className="btn-push-down"
              icon={<DownOutlined />}
              onClick={() => handlePushDown(record)}
            >
              下推
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
    <div className="page-purchase-request-list">
      <Card
        title={
          <Space>
            <Title level={4} style={{ margin: 0 }}>采购申请单</Title>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            className="btn-create-request"
            onClick={() => navigate('/purchase/requests/new')}
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
          scroll={{ x: 1100 }}
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

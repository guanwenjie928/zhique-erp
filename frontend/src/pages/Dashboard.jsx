import React, { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic, Table, Tag, Space, Typography, Button } from 'antd'
import {
  ShoppingCartOutlined, DollarOutlined, WarningOutlined,
  ClockCircleOutlined, ArrowRightOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { dashboardApi } from '../api'
import { formatMoney, formatDate } from '../components/CrudHelpers'

const { Title, Text } = Typography

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({})
  const [recentBills, setRecentBills] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      dashboardApi.getStats(),
      dashboardApi.getRecentBills(),
    ]).then(([s, b]) => {
      setStats(s)
      setRecentBills(b)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const statCards = [
    {
      title: '本月采购额',
      value: stats.total_purchase_amount || 0,
      prefix: '¥',
      icon: <ShoppingCartOutlined />,
      color: '#1677ff',
      bg: '#e6f4ff',
    },
    {
      title: '本月销售额',
      value: stats.total_sales_amount || 0,
      prefix: '¥',
      icon: <DollarOutlined />,
      color: '#52c41a',
      bg: '#f6ffed',
    },
    {
      title: '库存预警',
      value: stats.low_stock_count || 0,
      suffix: '种物料',
      icon: <WarningOutlined />,
      color: '#fa8c16',
      bg: '#fff7e6',
    },
    {
      title: '待付账款',
      value: stats.pending_payable_count || 0,
      suffix: '笔',
      icon: <ClockCircleOutlined />,
      color: '#eb2f96',
      bg: '#fff0f6',
    },
  ]

  const billColumns = [
    { title: '单据编号', dataIndex: 'bill_no', key: 'bill_no', width: 180 },
    { title: '单据类型', dataIndex: 'bill_type', key: 'bill_type', width: 100 },
    {
      title: '日期', dataIndex: 'bill_date', key: 'bill_date', width: 120,
      render: formatDate,
    },
    {
      title: '金额', dataIndex: 'amount', key: 'amount', width: 120,
      render: (v) => formatMoney(v),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (s) => {
        const map = { draft: '草稿', audited: '已审核', submitted: '已提交' }
        return <Tag>{map[s] || s}</Tag>
      },
    },
  ]

  return (
    <div>
      {/* 欢迎语 */}
      <Card style={{ marginBottom: 16, background: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)', border: 'none' }}>
        <Space direction="vertical" size={0}>
          <Title level={4} style={{ color: '#fff', margin: 0 }}>
            🐦 欢迎使用知雀ERP训练系统
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.85)' }}>
            恒达精密制造有限公司 · 今天是{formatDate(new Date())} · 让我们开始今天的采购训练吧！
          </Text>
        </Space>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {statCards.map((card, i) => (
          <Col span={6} key={i}>
            <Card loading={loading}>
              <Statistic
                title={card.title}
                value={card.value}
                prefix={card.prefix}
                suffix={card.suffix}
                valueStyle={{ color: card.color, fontSize: 28 }}
              />
              <div style={{
                position: 'absolute', right: 16, top: 16,
                width: 40, height: 40, borderRadius: 8,
                background: card.bg, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: card.color, fontSize: 20,
              }}>
                {card.icon}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 快捷入口 */}
      <Card title="快捷操作" style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <Button type="primary" icon={<ShoppingCartOutlined />}
            onClick={() => navigate('/purchase/requests/new')}>
            新建采购申请
          </Button>
          <Button onClick={() => navigate('/purchase/orders/new')}>
            新建采购订单
          </Button>
          <Button onClick={() => navigate('/purchase/receipts/new')}>
            采购入库
          </Button>
          <Button onClick={() => navigate('/finance/payments/new')}>
            新建付款单
          </Button>
          <Button onClick={() => navigate('/learning')}>
            🎓 开始学习
          </Button>
        </Space>
      </Card>

      {/* 最近单据 */}
      <Card title="最近单据" extra={
        <Button type="link" onClick={() => navigate('/purchase/orders')}>
          查看全部 <ArrowRightOutlined />
        </Button>
      }>
        <Table
          columns={billColumns}
          dataSource={recentBills}
          rowKey="bill_no"
          loading={loading}
          pagination={false}
          size="middle"
        />
      </Card>
    </div>
  )
}

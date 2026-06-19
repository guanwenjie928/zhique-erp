import React, { useEffect, useState } from 'react'
import { Card, Table, Tag, Space, Typography, Statistic, Row, Col, Progress, Empty, Spin, Button } from 'antd'
import { TrophyOutlined, ArrowLeftOutlined, RiseOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { learningApi } from '../../api'
import { formatDate, formatDateTime } from '../../components/CrudHelpers'

const { Title, Text } = Typography

/**
 * 我的成绩页面
 * 展示操作评分记录、成长曲线、各维度得分
 */
export default function MyScores() {
  const navigate = useNavigate()
  const [scores, setScores] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    learningApi.getScores()
      .then(setScores)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // 计算统计数据
  const totalOps = scores.length
  const avgScore = totalOps > 0
    ? (scores.reduce((sum, s) => sum + Number(s.total_score || 0), 0) / totalOps).toFixed(1)
    : '0.0'
  const avgAccuracy = totalOps > 0
    ? (scores.reduce((sum, s) => sum + Number(s.accuracy_score || 0), 0) / totalOps).toFixed(1)
    : '0.0'
  const avgCompleteness = totalOps > 0
    ? (scores.reduce((sum, s) => sum + Number(s.completeness_score || 0), 0) / totalOps).toFixed(1)
    : '0.0'
  const avgCompliance = totalOps > 0
    ? (scores.reduce((sum, s) => sum + Number(s.compliance_score || 0), 0) / totalOps).toFixed(1)
    : '0.0'
  const avgEfficiency = totalOps > 0
    ? (scores.reduce((sum, s) => sum + Number(s.efficiency_score || 0), 0) / totalOps).toFixed(1)
    : '0.0'

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v) => formatDateTime(v),
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 100,
      render: (v) => {
        const map = { purchase: '采购', inventory: '库存', finance: '财务', sales: '销售' }
        return <Tag>{map[v] || v}</Tag>
      },
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 120,
    },
    {
      title: '单据编号',
      dataIndex: 'target_bill_no',
      key: 'target_bill_no',
      width: 180,
    },
    {
      title: '准确性',
      dataIndex: 'accuracy_score',
      key: 'accuracy_score',
      width: 90,
      render: (v) => <ScoreTag score={Number(v)} />,
    },
    {
      title: '完整性',
      dataIndex: 'completeness_score',
      key: 'completeness_score',
      width: 90,
      render: (v) => <ScoreTag score={Number(v)} />,
    },
    {
      title: '合规性',
      dataIndex: 'compliance_score',
      key: 'compliance_score',
      width: 90,
      render: (v) => <ScoreTag score={Number(v)} />,
    },
    {
      title: '效率性',
      dataIndex: 'efficiency_score',
      key: 'efficiency_score',
      width: 90,
      render: (v) => <ScoreTag score={Number(v)} />,
    },
    {
      title: '总分',
      dataIndex: 'total_score',
      key: 'total_score',
      width: 90,
      render: (v) => <ScoreTag score={Number(v)} bold />,
    },
  ]

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/learning')}>返回</Button>
          <Title level={4} style={{ margin: 0 }}>
            <TrophyOutlined /> 我的成绩
          </Title>
        </Space>
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>
      ) : totalOps === 0 ? (
        <Card>
          <Empty description="还没有操作评分记录，去完成一些操作吧！">
            <Button type="primary" onClick={() => navigate('/learning')}>
              去学习
            </Button>
          </Empty>
        </Card>
      ) : (
        <>
          {/* 总览统计 */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总操作次数"
                  value={totalOps}
                  suffix="次"
                  prefix={<RiseOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="平均总分"
                  value={avgScore}
                  suffix="/ 100"
                  valueStyle={{ color: Number(avgScore) >= 80 ? '#52c41a' : Number(avgScore) >= 60 ? '#fa8c16' : '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card title="四维度雷达">
                <Row gutter={16}>
                  <Col span={6}>
                    <div style={{ textAlign: 'center' }}>
                      <Progress type="circle" percent={Number(avgAccuracy)} size={60}
                        strokeColor="#1677ff" />
                      <div style={{ marginTop: 4, fontSize: 12 }}>准确性</div>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div style={{ textAlign: 'center' }}>
                      <Progress type="circle" percent={Number(avgCompleteness)} size={60}
                        strokeColor="#52c41a" />
                      <div style={{ marginTop: 4, fontSize: 12 }}>完整性</div>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div style={{ textAlign: 'center' }}>
                      <Progress type="circle" percent={Number(avgCompliance)} size={60}
                        strokeColor="#fa8c16" />
                      <div style={{ marginTop: 4, fontSize: 12 }}>合规性</div>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div style={{ textAlign: 'center' }}>
                      <Progress type="circle" percent={Number(avgEfficiency)} size={60}
                        strokeColor="#722ed1" />
                      <div style={{ marginTop: 4, fontSize: 12 }}>效率性</div>
                    </div>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>

          {/* 评分明细表 */}
          <Card title="操作评分明细">
            <Table
              columns={columns}
              dataSource={scores}
              rowKey="id"
              size="middle"
              pagination={{ pageSize: 20, showSizeChanger: false }}
            />
          </Card>
        </>
      )}
    </div>
  )
}

// 评分标签组件
function ScoreTag({ score, bold }) {
  const color = score >= 90 ? 'success' : score >= 70 ? 'blue' : score >= 60 ? 'orange' : 'red'
  return (
    <Tag color={color} style={{ fontWeight: bold ? 700 : 400 }}>
      {Number(score).toFixed(1)}
    </Tag>
  )
}

import React, { useEffect, useState } from 'react'
import { Card, Col, Row, Progress, Button, Tag, Space, Typography, Empty, Spin, Statistic, message } from 'antd'
import {
  ReadOutlined, RocketOutlined, TrophyOutlined, BookOutlined,
  ArrowRightOutlined, CheckCircleOutlined, PlayCircleOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { learningApi } from '../../api'
import { useAppStore } from '../../stores/appStore'
import { TOUR_CONFIGS } from './tourConfigs'

const { Title, Paragraph, Text } = Typography

/**
 * 学习中心首页
 * 展示学习进度概览、引导课程入口、实战场景入口
 */
export default function LearningCenter() {
  const navigate = useNavigate()
  const { currentUser, startTour } = useAppStore()
  const [courses, setCourses] = useState([])
  const [scenarios, setScenarios] = useState([])
  const [scores, setScores] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      learningApi.getCourses(),
      learningApi.getScenarios(),
      learningApi.getScores(),
    ]).then(([c, s, sc]) => {
      setCourses(c || [])
      setScenarios(s || [])
      setScores(sc || [])
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const completedCount = courses.filter(c => c.status === 'completed').length
  const avgScore = scores.length > 0
    ? (scores.reduce((sum, s) => sum + (s.total_score || 0), 0) / scores.length).toFixed(1)
    : '0.0'

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>
  }

  return (
    <div>
      {/* 学习概览 */}
      <Card style={{ marginBottom: 16, background: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)', border: 'none' }}>
        <Row gutter={24} align="middle">
          <Col span={12}>
            <Title level={3} style={{ color: '#fff', margin: 0 }}>
              🎓 学习中心
            </Title>
            <Paragraph style={{ color: 'rgba(255,255,255,0.85)', marginTop: 8 }}>
              你好 {currentUser.real_name}！通过引导课程和实战场景，系统化掌握采购全链路操作技能。
            </Paragraph>
          </Col>
          <Col span={4}>
            <Statistic title={<span style={{color:'rgba(255,255,255,0.85)'}}>已完成课程</span>}
              value={`${completedCount}/${courses.length || 12}`}
              valueStyle={{ color: '#fff' }} />
          </Col>
          <Col span={4}>
            <Statistic title={<span style={{color:'rgba(255,255,255,0.85)'}}>平均得分</span>}
              value={avgScore}
              suffix="分"
              valueStyle={{ color: '#fff' }} />
          </Col>
          <Col span={4}>
            <Statistic title={<span style={{color:'rgba(255,255,255,0.85)'}}>练习次数</span>}
              value={scores.length}
              suffix="次"
              valueStyle={{ color: '#fff' }} />
          </Col>
        </Row>
      </Card>

      {/* 引导课程 */}
      <Card
        title={<Space><ReadOutlined /> 分步引导课程</Space>}
        style={{ marginBottom: 16 }}
        extra={<Button type="link" onClick={() => navigate('/learning/scores')}>查看成绩 <ArrowRightOutlined /></Button>}
      >
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          每个课程都有逐步引导提示，告诉你该做什么、为什么这么做，像有一位老师在你旁边手把手教。
        </Paragraph>
        <Row gutter={[16, 16]}>
          {courses.map((course, idx) => (
            <Col span={8} key={course.course_id}>
              <Card
                size="small"
                hoverable
                onClick={() => {
                  const config = TOUR_CONFIGS[course.course_id]
                  if (config) {
                    // 记录开始学习
                    learningApi.updateProgress(course.course_id, {
                      status: 'in_progress',
                      progress: 0,
                    }).catch(() => {})
                    // 启动引导
                    startTour(course.course_id, config.name, config.steps)
                  } else {
                    message.info('该课程内容正在编写中，敬请期待！')
                  }
                }}
                className={`tour-card-${course.course_id}`}
                actions={[
                  course.status === 'completed' ?
                    <Space><CheckCircleOutlined style={{color:'#52c41a'}} /> 已完成</Space> :
                    <Space><PlayCircleOutlined /> {course.status === 'in_progress' ? '继续学习' : '开始学习'}</Space>,
                ]}
              >
                <Card.Meta
                  avatar={
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: course.status === 'completed' ? '#f6ffed' : '#e6f4ff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: course.status === 'completed' ? '#52c41a' : '#1677ff',
                      fontSize: 18, fontWeight: 700,
                    }}>
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                  }
                  title={course.course_name}
                  description={
                    <Space direction="vertical" size={4} style={{width:'100%'}}>
                      <Text type="secondary" style={{fontSize:12}}>
                        {course.estimated_time || '约5-10分钟'}
                      </Text>
                      {course.status === 'completed' && course.score ? (
                        <Tag color="success">得分: {course.score}</Tag>
                      ) : course.status === 'in_progress' ? (
                        <Progress percent={course.progress || 0} size="small" />
                      ) : (
                        <Tag>未开始</Tag>
                      )}
                    </Space>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 实战场景 */}
      <Card
        title={<Space><RocketOutlined /> 实战场景模拟</Space>}
        style={{ marginBottom: 16 }}
        extra={<Button type="link" onClick={() => navigate('/learning/scenarios')}>全部场景 <ArrowRightOutlined /></Button>}
      >
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          内置真实采购业务场景，在真实系统中操作，系统记录每一步并给出评分和反馈。
        </Paragraph>
        <Row gutter={[16, 16]}>
          {scenarios.slice(0, 4).map((s) => (
            <Col span={6} key={s.code}>
              <Card
                size="small"
                hoverable
                onClick={() => navigate(`/learning/scenarios`)}
              >
                <Card.Meta
                  title={
                    <Space>
                      <Tag color={s.difficulty === 3 ? 'red' : s.difficulty === 2 ? 'orange' : 'blue'}>
                        {'★'.repeat(s.difficulty)}
                      </Tag>
                      {s.name}
                    </Space>
                  }
                  description={
                    <Text type="secondary" style={{fontSize:12}} ellipsis>
                      {s.background?.substring(0, 60)}...
                    </Text>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 知识库 & 术语词典入口 */}
      <Row gutter={16}>
        <Col span={12}>
          <Card hoverable onClick={() => navigate('/learning/knowledge')}>
            <Space direction="vertical" size={8}>
              <Space>
                <BookOutlined style={{fontSize: 24, color: '#1677ff'}} />
                <Title level={5} style={{margin:0}}>知识库</Title>
              </Space>
              <Text type="secondary">采购流程、ERP概念、供应链理论、金蝶操作对比</Text>
            </Space>
          </Card>
        </Col>
        <Col span={12}>
          <Card hoverable onClick={() => navigate('/learning/glossary')}>
            <Space direction="vertical" size={8}>
              <Space>
                <BookOutlined style={{fontSize: 24, color: '#52c41a'}} />
                <Title level={5} style={{margin:0}}>术语词典</Title>
              </Space>
              <Text type="secondary">BOM、MRP、FOB、MOQ、Lead Time等专业术语解释</Text>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

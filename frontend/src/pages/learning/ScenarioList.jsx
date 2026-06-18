import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Tag, Button, Space, Typography, Modal, Descriptions, Progress, message } from 'antd'
import { RocketOutlined, ArrowLeftOutlined, TrophyOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { learningApi } from '../../api'

const { Title, Paragraph, Text } = Typography

/**
 * 实战场景列表
 */
export default function ScenarioList() {
  const navigate = useNavigate()
  const [scenarios, setScenarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedScenario, setSelectedScenario] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)

  useEffect(() => {
    learningApi.getScenarios()
      .then(setScenarios)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleStart = (scenario) => {
    setModalVisible(false)
    message.loading('正在初始化场景数据...')
    learningApi.startScenario(scenario.code)
      .then(() => {
        message.success(`场景「${scenario.name}」已启动！`)
        // 根据场景涉及的模块导航到对应页面
        const module = scenario.modules?.split(',')[0]?.trim()
        const routeMap = {
          '采购': '/purchase/orders',
          '库存': '/inventory/list',
          '财务': '/finance/payables',
          '销售': '/sales/orders',
        }
        navigate(routeMap[module] || '/dashboard')
      })
      .catch(err => message.error(err.message))
  }

  const difficultyConfig = {
    1: { stars: '★☆☆', color: 'blue', label: '初级' },
    2: { stars: '★★☆', color: 'orange', label: '中级' },
    3: { stars: '★★★', color: 'red', label: '高级' },
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/learning')}>返回</Button>
          <Title level={4} style={{ margin: 0 }}>
            <RocketOutlined /> 实战场景模拟
          </Title>
        </Space>
        <Paragraph type="secondary" style={{ marginTop: 8 }}>
          每个场景模拟一个真实的采购业务情境。你需要在真实系统中完成操作，系统会记录你的每一步并给出评分。
        </Paragraph>
      </Card>

      <Row gutter={[16, 16]}>
        {scenarios.map(s => {
          const diff = difficultyConfig[s.difficulty] || difficultyConfig[1]
          let objectives = []
          try { objectives = JSON.parse(s.objectives || '[]') } catch {}

          return (
            <Col span={12} key={s.code}>
              <Card
                hoverable
                onClick={() => { setSelectedScenario(s); setModalVisible(true) }}
                actions={[
                  <Space><ClockCircleOutlined /> {s.estimated_time || 15}分钟</Space>,
                  <Space><TrophyOutlined /> {diff.label}</Space>,
                  <Button type="link" size="small">查看详情</Button>,
                ]}
              >
                <Card.Meta
                  title={
                    <Space>
                      <Tag color={diff.color}>{diff.stars}</Tag>
                      <span>{s.code} · {s.name}</span>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={4} style={{width:'100%'}}>
                      <Text type="secondary" ellipsis style={{fontSize:13}}>
                        {s.background?.substring(0, 80)}...
                      </Text>
                      <Space size={4} wrap>
                        {s.modules?.split(',').map(m => (
                          <Tag key={m} style={{fontSize:11}}>{m.trim()}</Tag>
                        ))}
                      </Space>
                    </Space>
                  }
                />
              </Card>
            </Col>
          )
        })}
      </Row>

      {/* 场景详情弹窗 */}
      <Modal
        title={selectedScenario ? `${selectedScenario.code} · ${selectedScenario.name}` : ''}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={640}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>取消</Button>,
          <Button key="start" type="primary" onClick={() => handleStart(selectedScenario)}>
            开始挑战
          </Button>,
        ]}
      >
        {selectedScenario && (
          <div>
            <Descriptions column={1} size="small" style={{marginBottom: 16}}>
              <Descriptions.Item label="难度">
                {difficultyConfig[selectedScenario.difficulty]?.stars} {difficultyConfig[selectedScenario.difficulty]?.label}
              </Descriptions.Item>
              <Descriptions.Item label="扮演角色">
                {selectedScenario.role}
              </Descriptions.Item>
              <Descriptions.Item label="预计用时">
                {selectedScenario.estimated_time || 15} 分钟
              </Descriptions.Item>
              <Descriptions.Item label="涉及模块">
                {selectedScenario.modules}
              </Descriptions.Item>
            </Descriptions>

            <Paragraph>
              <Text strong>📋 场景背景</Text>
              <Paragraph style={{marginTop: 4}}>
                {selectedScenario.background}
              </Paragraph>
            </Paragraph>

            {(() => {
              let objectives = []
              try { objectives = JSON.parse(selectedScenario.objectives || '[]') } catch {}
              if (objectives.length === 0) return null
              return (
                <Paragraph>
                  <Text strong>🎯 任务目标</Text>
                  <ol style={{ marginTop: 8, paddingLeft: 20 }}>
                    {objectives.map((obj, i) => (
                      <li key={i} style={{marginBottom: 4}}>{obj}</li>
                    ))}
                  </ol>
                </Paragraph>
              )
            })()}

            {(() => {
              let constraints = []
              try { constraints = JSON.parse(selectedScenario.constraints || '[]') } catch {}
              if (constraints.length === 0) return null
              return (
                <Paragraph>
                  <Text strong>⚠️ 约束条件</Text>
                  <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                    {constraints.map((c, i) => (
                      <li key={i} style={{marginBottom: 4, color: '#fa8c16'}}>{c}</li>
                    ))}
                  </ul>
                </Paragraph>
              )
            })()}

            <Paragraph type="secondary" style={{fontSize: 13, marginTop: 16}}>
              💡 提示：开始场景后，请在真实系统中完成操作。完成后系统会自动评估你的操作并给出评分和反馈。
            </Paragraph>
          </div>
        )}
      </Modal>
    </div>
  )
}

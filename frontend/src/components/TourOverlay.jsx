import React, { useEffect } from 'react'
import { Card, Button, Space, Typography, Tag, Progress } from 'antd'
import {
  ArrowLeftOutlined, ArrowRightOutlined, CloseOutlined,
  CheckCircleOutlined, ReadOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import { learningApi } from '../api'

const { Title, Paragraph, Text } = Typography

/**
 * 全局引导浮层组件
 * 渲染在MainLayout中，覆盖在所有页面之上
 * 通过appStore的activeTour状态控制显示
 */
export default function TourOverlay() {
  const navigate = useNavigate()
  const { activeTour, tourActive, nextTourStep, prevTourStep, stopTour } = useAppStore()

  // 当步骤变化时，导航到对应路由
  useEffect(() => {
    if (!activeTour) return
    const currentStepData = activeTour.steps[activeTour.currentStep]
    if (currentStepData?.route) {
      navigate(currentStepData.route)
    }
  }, [activeTour?.currentStep, activeTour?.courseId])

  // 不活跃时不渲染
  if (!tourActive || !activeTour) return null

  const currentStepData = activeTour.steps[activeTour.currentStep]
  if (!currentStepData) return null

  const isLastStep = activeTour.currentStep === activeTour.steps.length - 1
  const progress = Math.round(((activeTour.currentStep + 1) / activeTour.steps.length) * 100)

  // 完成课程
  const handleFinish = () => {
    learningApi.updateProgress(activeTour.courseId, {
      status: 'completed',
      progress: 100,
    }).catch(() => {})
    stopTour()
    navigate('/learning')
  }

  // 跳过课程
  const handleSkip = () => {
    learningApi.updateProgress(activeTour.courseId, {
      status: 'in_progress',
      progress: progress,
    }).catch(() => {})
    stopTour()
    navigate('/learning')
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      width: 420,
      zIndex: 9999,
      animation: 'fadeInUp 0.3s ease',
    }}>
      <Card
        size="small"
        style={{
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          border: '1px solid #d9d9f5',
          borderRadius: 12,
          overflow: 'hidden',
        }}
        bodyStyle={{ padding: 0 }}
      >
        {/* 头部 */}
        <div style={{
          background: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)',
          padding: '12px 16px',
          color: '#fff',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <ReadOutlined />
              <Text strong style={{ color: '#fff', fontSize: 14 }}>
                {activeTour.courseName}
              </Text>
            </Space>
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={handleSkip}
              style={{ color: 'rgba(255,255,255,0.85)' }}
            />
          </div>
          <Progress
            percent={progress}
            size="small"
            strokeColor={{ from: '#fff', to: '#b37feb' }}
            trailColor="rgba(255,255,255,0.2)"
            style={{ marginTop: 8, marginBottom: 0 }}
          />
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
            步骤 {activeTour.currentStep + 1} / {activeTour.steps.length}
          </div>
        </div>

        {/* 内容区 */}
        <div style={{ padding: '16px' }}>
          <Title level={5} style={{ marginBottom: 8, color: '#722ed1' }}>
            {currentStepData.title}
          </Title>
          <Paragraph style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 12, color: '#595959' }}>
            {currentStepData.content}
          </Paragraph>

          {/* 操作区 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <Button
              size="small"
              icon={<ArrowLeftOutlined />}
              onClick={prevTourStep}
              disabled={activeTour.currentStep === 0}
            >
              上一步
            </Button>
            <Space>
              <Button size="small" onClick={handleSkip}>
                跳过
              </Button>
              {isLastStep ? (
                <Button type="primary" size="small" icon={<CheckCircleOutlined />} onClick={handleFinish}>
                  完成课程
                </Button>
              ) : (
                <Button type="primary" size="small" onClick={nextTourStep}>
                  下一步 <ArrowRightOutlined />
                </Button>
              )}
            </Space>
          </div>
        </div>
      </Card>

      {/* CSS动画 */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

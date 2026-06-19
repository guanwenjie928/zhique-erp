import React, { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Spin } from 'antd'
import { useAppStore } from '../../stores/appStore'
import { TOUR_CONFIGS } from './tourConfigs'
import { learningApi } from '../../api'

/**
 * 引导教学页面（兼容旧路由）
 * 现在引导通过全局TourOverlay浮层实现
 * 此页面仅负责启动引导并重定向
 */
export default function GuidedTour() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { startTour } = useAppStore()

  useEffect(() => {
    const config = TOUR_CONFIGS[courseId]
    if (config) {
      // 记录开始学习
      learningApi.updateProgress(courseId, {
        status: 'in_progress',
        progress: 0,
      }).catch(() => {})
      // 启动引导浮层
      startTour(courseId, config.name, config.steps)
      // 导航到第一步的路由
      const firstRoute = config.steps[0]?.route || '/dashboard'
      navigate(firstRoute)
    } else {
      navigate('/learning')
    }
  }, [courseId])

  return (
    <div style={{ textAlign: 'center', padding: 100 }}>
      <Spin size="large" tip="正在启动引导课程..." />
    </div>
  )
}

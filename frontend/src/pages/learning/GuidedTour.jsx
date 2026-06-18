import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, Button, Space, Typography, Result, Spin, message } from 'antd'
import { ArrowLeftOutlined, HomeOutlined } from '@ant-design/icons'
import Joyride from 'react-joyride'

const { Title, Paragraph } = Typography

/**
 * 引导教学页面
 * 使用 react-joyride 实现高亮遮罩 + 气泡提示
 * 根据课程ID加载对应的引导步骤配置
 */
export default function GuidedTour() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [tourSteps, setTourSteps] = useState([])
  const [courseInfo, setCourseInfo] = useState(null)
  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  // 引导课程配置库
  const COURSE_CONFIGS = {
    'tour_01': {
      name: '系统总览导览',
      estimated_time: '约5分钟',
      steps: [
        {
          target: '.ant-layout-sider',
          content: '这是侧边栏导航菜单。知雀ERP包含采购管理、库存管理、财务管理、销售管理和学习中心五大模块。点击各模块名称可展开子菜单。',
          spotlightClicks: false,
        },
        {
          target: '.ant-menu-item:nth-child(1)',
          content: '「工作台」是系统首页，展示关键业务数据概览和快捷操作入口。',
        },
        {
          target: '[data-menu-key="purchase"]',
          content: '「采购管理」是系统的核心模块。包含采购申请单、采购订单、采购入库单、采购退货单和供应商管理。采购流程为：申请→订单→入库→付款。',
        },
        {
          target: '[data-menu-key="inventory"]',
          content: '「库存管理」管理所有物料的库存数量。采购入库会增加库存，销售出库会减少库存。还可以进行库存盘点和库存流水查询。',
        },
        {
          target: '[data-menu-key="finance"]',
          content: '「财务管理」管理应付账款（欠供应商的钱）和应收账款（客户欠我们的钱）。采购入库后自动生成应付，销售出库后自动生成应收。',
        },
        {
          target: '.ant-switch',
          content: '这是学习模式开关。开启后系统会提供引导提示和操作评分。关闭后进入自由模式，可自由操作不受引导。建议学习阶段保持开启。',
        },
        {
          target: 'body',
          content: '好了！系统总览介绍完毕。接下来可以开始「创建你的第一张采购申请单」课程。祝你学习顺利！🐦',
        },
      ],
    },
    'tour_02': {
      name: '创建你的第一张采购申请单',
      estimated_time: '约8分钟',
      steps: [
        {
          target: '[data-menu-key="/purchase/requests"]',
          content: '首先，点击侧边栏「采购管理」→「采购申请单」。采购申请单是采购流程的起点，由需求部门发起。',
          spotlightClicks: true,
        },
        {
          target: '.btn-create-bill',
          content: '点击「新建」按钮，创建一张新的采购申请单。',
          spotlightClicks: true,
        },
        {
          target: '.form-bill-date',
          content: '选择单据日期。系统默认填入今天日期，通常不需要修改。',
        },
        {
          target: '.form-department',
          content: '选择申请部门。作为采购员，通常选择「采购部」。如果是其他部门发起的申请，选择对应部门。',
        },
        {
          target: '.form-expected-date',
          content: '填写期望到货日期。这是告诉采购部门这批物料最晚什么时候需要到货。根据生产计划合理安排。',
        },
        {
          target: '.form-reason',
          content: '填写申请原因。如「Q3生产备货」、「紧急补料」、「新项目试产」等。清晰的原因有助于审批人快速决策。',
        },
        {
          target: '.btn-add-detail',
          content: '点击「添加明细行」来添加需要采购的物料。每行对应一种物料。',
          spotlightClicks: true,
        },
        {
          target: '.detail-table .ant-select',
          content: '在物料列选择需要采购的物料。可以从下拉列表中搜索物料编码或名称。',
        },
        {
          target: '.detail-table .ant-input-number',
          content: '输入申请数量。注意单位会自动带出（如吨、kg、个等），确保数量与单位匹配。',
        },
        {
          target: '.btn-save',
          content: '点击「保存」保存草稿。保存后可以继续编辑，确认无误后点击「提交审核」。',
          spotlightClicks: true,
        },
        {
          target: 'body',
          content: '太棒了！你已学会创建采购申请单。接下来学习采购订单的创建。记住：申请单是"我要买什么"，采购订单是"向谁买、多少钱"。',
        },
      ],
    },
    'tour_03': {
      name: '采购申请单审批流程',
      estimated_time: '约5分钟',
      steps: [
        {
          target: '[data-menu-key="/purchase/requests"]',
          content: '进入采购申请单列表。找到状态为"已提交"的申请单，这些是等待审核的。',
          spotlightClicks: true,
        },
        {
          target: '.ant-table-row',
          content: '点击单据编号查看详情。审核前请仔细核对：申请的物料是否合理、数量是否与生产计划匹配、期望日期是否可行。',
        },
        {
          target: '.btn-audit',
          content: '确认无误后，点击「审核」按钮。审核后申请单状态变为"已审核"，可以被采购员关联生成采购订单。',
          spotlightClicks: true,
        },
        {
          target: '.btn-push-down',
          content: '审核后可以点击「下推」直接生成采购订单。系统会自动带出申请单中的物料和数量，你只需选择供应商和填写价格。',
        },
        {
          target: 'body',
          content: '审批流程就这些！关键原则：申请单审核前可以修改，审核后需要反审核才能改。审核意味着对这个采购需求的认可。',
        },
      ],
    },
    'tour_04': {
      name: '创建采购订单',
      estimated_time: '约10分钟',
      steps: [
        {
          target: '[data-menu-key="/purchase/orders"]',
          content: '进入「采购订单」列表页。采购订单是向供应商发出的正式采购要约，具有法律效力。',
          spotlightClicks: true,
        },
        {
          target: '.btn-create-bill',
          content: '点击「新建」创建采购订单。',
          spotlightClicks: true,
        },
        {
          target: '.form-supplier',
          content: '选择供应商。这是关键决策——选择合格的供应商直接影响交期、质量和价格。A级供应商优先考虑。',
        },
        {
          target: '.form-expected-date',
          content: '填写预计交货日期。需考虑供应商的生产周期（Lead Time）和运输时间。',
        },
        {
          target: '.form-payment-terms',
          content: '选择付款条件。常见的有：月结30天（收货后30天付款）、预付款30%（下单时付30%，收货后付70%）等。需与供应商协议一致。',
        },
        {
          target: '.btn-add-detail',
          content: '添加采购明细行。如果从申请单下推生成，物料和数量会自动带出。',
          spotlightClicks: true,
        },
        {
          target: '.detail-table .ant-select',
          content: '选择物料。系统会自动带出物料的规格、单位和标准单价。',
        },
        {
          target: '.detail-table .ant-input-number',
          content: '输入采购数量和单价。单价可以参考标准价格，但应根据实际谈判价格调整。注意：单价是不含税价格。',
        },
        {
          target: '.amount-summary',
          content: '系统自动计算金额合计、税额合计和价税合计。请核对金额是否正确。',
        },
        {
          target: '.btn-save',
          content: '保存草稿，确认无误后提交审核。',
          spotlightClicks: true,
        },
        {
          target: 'body',
          content: '采购订单创建完成！记住采购订单的核心要素：供应商、物料、数量、单价、交期、付款条件。这些信息将贯穿后续的入库和付款流程。',
        },
      ],
    },
  }

  useEffect(() => {
    const config = COURSE_CONFIGS[courseId]
    if (config) {
      setCourseInfo(config)
      setTourSteps(config.steps.map(s => ({
        ...s,
        disableBeacon: true,
      })))
      setLoading(false)
      // 延迟启动引导，确保DOM已渲染
      setTimeout(() => setRun(true), 500)
    } else {
      setLoading(false)
    }
  }, [courseId])

  const handleJoyrideCallback = useCallback((data) => {
    const { status, index, action } = data

    if (status === 'finished') {
      message.success('课程已完成！')
      // 记录完成状态
      learningApi?.updateProgress?.(courseId, {
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
      }).catch(() => {})
      navigate('/learning')
    }

    if (action === 'close') {
      navigate('/learning')
    }

    setStepIndex(index)
  }, [courseId, navigate])

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>
  }

  if (!courseInfo) {
    return (
      <Result
        status="404"
        title="课程不存在"
        extra={<Button type="primary" onClick={() => navigate('/learning')}>返回学习中心</Button>}
      />
    )
  }

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/learning')}>返回</Button>
          <Title level={4} style={{ margin: 0 }}>{courseInfo.name}</Title>
        </Space>
        <Paragraph type="secondary" style={{ marginTop: 8 }}>
          跟随引导提示逐步操作，每一步都会告诉你该做什么和为什么这么做。准备好了吗？
        </Paragraph>
      </Card>

      <Joyride
        steps={tourSteps}
        run={run}
        continuous={true}
        showSkipButton={true}
        showProgress={true}
        stepIndex={stepIndex}
        callback={handleJoyrideCallback}
        locale={{
          back: '上一步',
          close: '关闭',
          last: '完成课程',
          next: '下一步',
          skip: '跳过',
        }}
        styles={{
          options: {
            primaryColor: '#1677ff',
            zIndex: 10000,
            overlayColor: 'rgba(0, 0, 0, 0.6)',
            spotlightShadow: '0 0 15px rgba(0, 0, 0, 0.5)',
          },
          tooltip: {
            fontSize: 14,
            padding: 16,
          },
        }}
      />
    </>
  )
}

import React, { useState, useMemo } from 'react'
import { Card, Input, Row, Col, Button, Modal, Tag, Space, Typography, Empty, Tabs } from 'antd'
import { SearchOutlined, BookOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const { Title, Paragraph, Text } = Typography

/**
 * 知识库页面
 * 包含采购流程、ERP概念、供应链理论、金蝶操作对比等文章
 */

const KNOWLEDGE_ARTICLES = [
  {
    id: 'k01',
    category: '采购流程',
    title: '采购全流程详解：从需求到付款',
    content: `
采购是企业供应链的核心环节。一个完整的采购流程包含以下步骤：

1. 需求识别与采购申请
   - 生产部门根据生产计划提出物料需求
   - 填写采购申请单，注明物料、数量、期望交期
   - 申请单需经部门主管审核

2. 供应商选择与比价
   - 根据物料需求筛选合格供应商
   - 向多家供应商询价，进行比价分析
   - 综合考虑价格、质量、交期、付款条件选择最优供应商

3. 采购订单下达
   - 创建采购订单，明确物料、数量、单价、交期、付款条件
   - 采购订单经审核后正式生效
   - 将订单发送给供应商确认

4. 订单跟催
   - 定期跟踪供应商生产进度
   - 确保按时交货，如有异常及时沟通处理

5. 收货验收
   - 供应商交货时核对采购订单
   - 质检部门检验物料质量
   - 合格品办理入库，不合格品退货

6. 入库与库存更新
   - 仓管员清点数量，录入入库单
   - 系统自动增加库存数量
   - 生成应付账款记录

7. 付款
   - 根据付款条件（如月结30天）安排付款
   - 核对发票与入库单是否一致
   - 创建付款单，经审核后付款

关键原则：
- 采购订单不影响库存和账务，仅是计划
- 入库单审核后才增加库存和生成应付
- 付款单审核后才减少应付和银行存款
`,
  },
  {
    id: 'k02',
    category: '采购流程',
    title: '采购退货处理流程',
    content: `
当来料检验发现质量不合格时，需要执行采购退货流程：

1. 在入库单中记录不合格数量
2. 创建采购退货单，关联原入库单
3. 退货单审核后：
   - 自动扣减库存数量
   - 减少对应的应付账款
4. 与供应商沟通退换货事宜
5. 如需重新采购，创建新的采购订单

注意事项：
- 退货单使用负数表示数量减少
- 退货原因需详细记录，便于供应商改善
- 退货产生的运输费用需明确责任方
`,
  },
  {
    id: 'k03',
    category: 'ERP概念',
    title: 'BOM（物料清单）详解',
    content: `
BOM（Bill of Materials）是物料清单的缩写，是ERP系统的核心概念之一。

什么是BOM？
BOM描述了生产一个成品所需的所有原材料、半成品及其数量关系。
例如：生产1个"精密连接器A型"需要：
- 1个冲压外壳（半成品）
- 1个PCBA控制板（半成品）
- 0.1kg铜排（原材料）

BOM的层级：
- 成品（FG）→ 半成品（SF）→ 原材料（RM）
- 一个成品可能有多个层级的BOM
- BOM是MRP（物料需求计划）的计算基础

BOM在采购中的应用：
- 根据销售订单和BOM计算所需原材料
- 结合库存情况生成采购建议
- 这就是MRP的核心逻辑

在知雀ERP中，BOM维护在"基础设置→物料档案"中，每个成品可关联多个子物料。
`,
  },
  {
    id: 'k04',
    category: 'ERP概念',
    title: 'MRP（物料需求计划）入门',
    content: `
MRP（Material Requirements Planning）是ERP系统的核心算法。

MRP的计算逻辑：
1. 输入：销售订单（需要什么成品、多少、何时要）
2. 展开：根据BOM计算所需的原材料
3. 扣减：减去现有库存和在途数量
4. 输出：采购建议（买什么、买多少、何时买）

简单示例：
- 销售订单：需要100个产品A，7月1日交货
- BOM：1个产品A = 2个材料X + 3个材料Y
- 库存：材料X有50个，材料Y有100个
- 需采购：材料X = 100×2-50 = 150个，材料Y = 100×3-100 = 200个

考虑Lead Time（采购提前期）：
- 如果材料X的Lead Time是7天，最晚6月24日要下单
- 这就是为什么采购需要提前规划

MRP是采购岗位的核心技能之一，理解MRP能帮助你做出更好的采购决策。
`,
  },
  {
    id: 'k05',
    category: 'ERP概念',
    title: '安全库存与经济订货量',
    content: `
安全库存（Safety Stock）：
- 为应对需求波动和供应延迟而设置的最低库存水平
- 当库存低于安全库存时触发采购预警
- 计算公式：安全库存 = 平均日消耗量 × 采购提前期 × 安全系数

经济订货量（EOQ, Economic Order Quantity）：
- 使采购总成本最低的单次采购数量
- 总成本 = 采购成本 + 订货成本 + 仓储成本
- 计算公式：EOQ = √(2×年需求量×单次订货成本÷单位仓储成本)

实际应用：
- 知雀ERP中每个物料都设有安全库存
- 库存查询页面会自动预警低于安全库存的物料
- 采购员应根据EOQ和供应商MOQ综合考虑采购量
`,
  },
  {
    id: 'k06',
    category: '供应链',
    title: '供应商评估与管理',
    content: `
供应商评估的五个维度（SQCDP）：

1. Safety（安全）- 供应商的安全生产记录
2. Quality（质量）- 来料合格率、质量投诉次数
3. Cost（成本）- 价格竞争力、降本配合度
4. Delivery（交付）- 按时交货率、交期灵活性
5. People（人员）- 团队专业度、服务态度

供应商评级标准：
- A级（优秀）：综合评分≥90分，优先分配订单
- B级（合格）：综合评分70-89分，正常合作
- C级（待改进）：综合评分<70分，限制订单，要求整改
- 不合格：淘汰出供应商名录

在知雀ERP中，供应商档案中可设置评级。C级供应商的来料需要加强检验。
`,
  },
  {
    id: 'k07',
    category: '金蝶对比',
    title: '知雀ERP与金蝶KIS操作对比',
    content: `
知雀ERP参考金蝶KIS进销存设计，核心流程一致，以下为操作对比：

| 功能 | 金蝶KIS | 知雀ERP |
|------|---------|---------|
| 采购订单 | 采购管理→采购订单→新增 | 采购管理→采购订单→新建 |
| 入库 | 采购管理→采购入库→关联订单 | 采购管理→采购入库单→从订单下推 |
| 审核 | 单据上点"审核"按钮 | 单据上点"审核"按钮 |
| 付款 | 资金管理→付款单→选供应商 | 财务管理→付款单→选供应商→核销 |
| 库存查询 | 仓库管理→库存查询 | 库存管理→库存查询 |
| 报表 | 各模块下报表子菜单 | 各模块列表页支持筛选和导出 |

核心差异：
1. 金蝶支持红字冲销（负数单据），知雀ERP用独立的退货单处理
2. 金蝶有"反审核"功能，知雀ERP当前版本暂不支持
3. 金蝶支持多账套，知雀ERP为单账套训练系统
4. 知雀ERP增加了学习模式和操作评分，这是金蝶没有的
`,
  },
  {
    id: 'k08',
    category: '采购流程',
    title: '付款条件与账期管理',
    content: `
常见的付款条件：

1. 预付款（Advance Payment）
   - 下单时支付全款或部分款项
   - 适用于新供应商或定制物料

2. 月结N天（Net N Days）
   - 月结30天：当月发货，次月底前付款
   - 月结60天：当月发货，60天后付款
   - 最常见的付款方式

3. 货到付款（COD）
   - 收货时立即付款
   - 适用于小金额或现货采购

4. 分期付款
   - 如30%预付 + 40%到货 + 30%验收后
   - 适用于大额设备采购

账期管理要点：
- 应付账款的"到期日期"根据付款条件自动计算
- 超过到期日期未付款会产生逾期
- 月末需要核对应付账款余额与供应商对账单
- 合理利用账期可以优化企业现金流
`,
  },
]

const CATEGORIES = ['全部', '采购流程', 'ERP概念', '供应链', '金蝶对比']

export default function KnowledgeBase() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('全部')
  const [selectedArticle, setSelectedArticle] = useState(null)

  const filteredArticles = useMemo(() => {
    return KNOWLEDGE_ARTICLES.filter(a => {
      const matchCategory = activeCategory === '全部' || a.category === activeCategory
      const matchSearch = !search ||
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.content.toLowerCase().includes(search.toLowerCase())
      return matchCategory && matchSearch
    })
  }, [search, activeCategory])

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{width: '100%'}}>
          <Space>
            <Button onClick={() => navigate('/learning')} icon={<ArrowLeftOutlined />}>返回</Button>
            <Title level={4} style={{ margin: 0 }}>
              <BookOutlined /> 知识库
            </Title>
          </Space>
          <Input
            placeholder="搜索知识库..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
            size="large"
          />
        </Space>
      </Card>

      <Tabs
        items={CATEGORIES.map(c => ({ key: c, label: c }))}
        activeKey={activeCategory}
        onChange={setActiveCategory}
        style={{ marginBottom: 16 }}
      />

      <Row gutter={[16, 16]}>
        {filteredArticles.map(article => (
          <Col span={12} key={article.id}>
            <Card
              hoverable
              onClick={() => setSelectedArticle(article)}
            >
              <Card.Meta
                title={
                  <Space>
                    <Tag color="blue">{article.category}</Tag>
                    {article.title}
                  </Space>
                }
                description={
                  <Paragraph
                    ellipsis={{ rows: 3 }}
                    style={{ marginBottom: 0, fontSize: 13 }}
                  >
                    {article.content.trim().substring(0, 150)}...
                  </Paragraph>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      {filteredArticles.length === 0 && (
        <Empty description="未找到相关文章" />
      )}

      {/* 文章详情弹窗 */}
      <Modal
        title={selectedArticle?.title}
        open={!!selectedArticle}
        onCancel={() => setSelectedArticle(null)}
        footer={null}
        width={720}
      >
        {selectedArticle && (
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: 14 }}>
            {selectedArticle.content}
          </div>
        )}
      </Modal>
    </div>
  )
}


import React, { useState, useMemo } from 'react'
import { Card, Input, List, Tag, Space, Typography, Empty, Button } from 'antd'
import { SearchOutlined, BookOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const { Title, Paragraph, Text } = Typography

/**
 * 术语词典
 * 包含采购、供应链、ERP领域的专业术语
 */

const GLOSSARY = [
  { term: 'BOM', en: 'Bill of Materials', category: 'ERP', def: '物料清单。描述生产一个产品所需的所有零部件及其数量关系的清单。', example: '生产1个连接器需要1个外壳+1个PCBA板+0.1kg铜线' },
  { term: 'MRP', en: 'Material Requirements Planning', category: 'ERP', def: '物料需求计划。根据销售订单和BOM计算所需原材料采购量的算法。', example: '客户要100个产品A，根据BOM展开计算需要采购多少原材料' },
  { term: 'MOQ', en: 'Minimum Order Quantity', category: '采购', def: '最小起订量。供应商接受的最少订购数量。', example: '某供应商规定铜线MOQ为100kg，低于100kg不接单' },
  { term: 'Lead Time', en: 'Lead Time', category: '供应链', def: '采购提前期。从下单到收货的总时间，包括供应商生产时间和运输时间。', example: '钢板Lead Time为7天，意味着下单后7天才能到货' },
  { term: 'FOB', en: 'Free On Board', category: '贸易', def: '离岸价。卖方负责将货物运到装运港船上，之后的风险和费用由买方承担。', example: 'FOB上海港，意味着卖方只需将货物送到上海港船上' },
  { term: 'CIF', en: 'Cost, Insurance & Freight', category: '贸易', def: '成本加保险费加运费。卖方负责将货物运到目的港并承担保险和运费。', example: 'CIF洛杉矶，卖方承担到洛杉矶港的运费和保险' },
  { term: 'EXW', en: 'Ex Works', category: '贸易', def: '工厂交货。买方从卖方工厂提货，承担所有运输费用和风险。', example: 'EXW工厂提货，买方需要自己安排物流' },
  { term: '安全库存', en: 'Safety Stock', category: '库存', def: '为应对需求波动和供应延迟而保持的最低库存水平。', example: '铜线安全库存500kg，低于500kg触发采购预警' },
  { term: 'EOQ', en: 'Economic Order Quantity', category: '采购', def: '经济订货量。使采购总成本（订货成本+仓储成本）最低的单次采购量。', example: '经计算EOQ=500个，意味着每次采购500个总成本最低' },
  { term: '采购申请单', en: 'Purchase Requisition', category: 'ERP', def: '需求部门向采购部门提出的采购请求，是采购流程的起点。', example: '生产部提交采购申请单，申请采购10吨冷轧钢板' },
  { term: '采购订单', en: 'Purchase Order (PO)', category: 'ERP', def: '向供应商发出的正式采购要约，具有法律效力。', example: 'PO-20260618-001，向恒达钢业订购10吨钢板' },
  { term: '收料通知单', en: 'Receiving Notice', category: 'ERP', def: '通知仓库即将到货的单据，仓库据此准备收货。', example: '供应商发货后，系统生成收料通知单通知仓库' },
  { term: '采购入库单', en: 'Purchase Receipt', category: 'ERP', def: '记录实际收货情况的单据，审核后增加库存并生成应付账款。', example: '收到10吨钢板，入库单审核后库存+10吨，应付+52000元' },
  { term: '应付账款', en: 'Accounts Payable (AP)', category: '财务', def: '企业因采购商品或接受服务而应付给供应商的款项。', example: '入库后系统自动生成应付账款52000元' },
  { term: '应收账款', en: 'Accounts Receivable (AR)', category: '财务', def: '企业因销售商品或提供服务而应向客户收取的款项。', example: '销售出库后系统自动生成应收账款12800元' },
  { term: '账龄分析', en: 'Aging Analysis', category: '财务', def: '按欠款时间长短对应收/应付账款进行分类分析，评估坏账风险。', example: '0-30天、31-60天、61-90天、90天以上四档' },
  { term: '付款单', en: 'Payment Order', category: '财务', def: '记录向供应商付款信息的单据，审核后减少应付账款。', example: '向恒达钢业付款52000元，核销对应应付账款' },
  { term: '下推', en: 'Push Down', category: 'ERP', def: '金蝶ERP术语，指从上游单据自动生成下游单据的操作。', example: '采购订单下推生成入库单，自动带出物料信息' },
  { term: '源单', en: 'Source Document', category: 'ERP', def: '下游单据所关联的上游单据，用于追溯业务来源。', example: '入库单的源单是采购订单' },
  { term: '红字冲销', en: 'Red Entry Reversal', category: '财务', def: '用负数（红字）单据冲减原记录的方法，常用于退货处理。', example: '退货时开具红字入库单，数量为负数' },
  { term: '月结', en: 'Monthly Settlement', category: '财务', def: '月末对所有单据进行核对、结转和结账的过程。', example: '每月最后一天进行月结，核对所有应收应付' },
  { term: '库存盘点', en: 'Stocktaking', category: '库存', def: '核对账面库存与实物库存是否一致的过程。', example: '月度盘点发现铜线账面500kg，实盘498kg，盘亏2kg' },
  { term: '移动平均成本', en: 'Moving Average Cost', category: '财务', def: '每次入库后重新计算的库存平均成本。新成本 = (原库存金额+新入库金额) / (原库存数量+新入库数量)', example: '原库存10吨×5200=52000，新入库5吨×5400=27000，新均价=(52000+27000)/15=5266.67' },
  { term: '供应商评级', en: 'Supplier Rating', category: '供应链', def: '对供应商的综合评价分级，通常分为A/B/C三级。', example: 'A级供应商优先分配订单，C级需限期整改' },
  { term: 'JIT', en: 'Just In Time', category: '供应链', def: '准时制采购。在需要的时间、按需要的数量采购所需物料，最小化库存。', example: '丰田生产系统核心，要求供应商准时小批量送货' },
  { term: 'VMI', en: 'Vendor Managed Inventory', category: '供应链', def: '供应商管理库存。供应商在采购方仓库管理库存，采购方使用后结算。', example: '供应商在工厂设仓库，按实际消耗结算' },
]

const CATEGORIES = ['全部', 'ERP', '采购', '供应链', '财务', '库存', '贸易']

export default function Glossary() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('全部')

  const filteredTerms = useMemo(() => {
    return GLOSSARY.filter(g => {
      const matchCategory = activeCategory === '全部' || g.category === activeCategory
      const s = search.toLowerCase()
      const matchSearch = !search ||
        g.term.toLowerCase().includes(s) ||
        g.en.toLowerCase().includes(s) ||
        g.def.toLowerCase().includes(s)
      return matchCategory && matchSearch
    })
  }, [search, activeCategory])

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{width: '100%'}}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/learning')}>返回</Button>
            <Title level={4} style={{ margin: 0 }}>
              <BookOutlined /> 术语词典
            </Title>
            <Tag>{GLOSSARY.length} 个术语</Tag>
          </Space>
          <Input
            placeholder="搜索术语（中英文均可）..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
            size="large"
          />
          <Space wrap>
            {CATEGORIES.map(c => (
              <Tag
                key={c}
                style={{ cursor: 'pointer', padding: '2px 12px', fontSize: 13 }}
                color={activeCategory === c ? 'blue' : 'default'}
                onClick={() => setActiveCategory(c)}
              >
                {c}
              </Tag>
            ))}
          </Space>
        </Space>
      </Card>

      <List
        grid={{ gutter: 16, column: 2 }}
        dataSource={filteredTerms}
        locale={{ emptyText: <Empty description="未找到相关术语" /> }}
        renderItem={item => (
          <List.Item>
            <Card size="small" hoverable>
              <Space direction="vertical" size={4} style={{width: '100%'}}>
                <Space>
                  <Text strong style={{fontSize: 16}}>{item.term}</Text>
                  <Text type="secondary" style={{fontSize: 12}}>{item.en}</Text>
                  <Tag style={{fontSize: 11}}>{item.category}</Tag>
                </Space>
                <Paragraph style={{margin: 0, fontSize: 13}}>
                  {item.def}
                </Paragraph>
                {item.example && (
                  <Text type="secondary" style={{fontSize: 12}}>
                    💡 {item.example}
                  </Text>
                )}
              </Space>
            </Card>
          </List.Item>
        )}
      />
    </div>
  )
}

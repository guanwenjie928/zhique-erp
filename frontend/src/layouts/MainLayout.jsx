import React from 'react'
import { Outlet } from 'react-router-dom'
import { Layout, Menu, Switch, Badge, Avatar, Dropdown, Space } from 'antd'
import {
  DashboardOutlined, ShoppingCartOutlined, InboxOutlined,
  DollarOutlined, ShoppingOutlined, ReadOutlined, SettingOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, BellOutlined, UserOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'

const { Header, Sider, Content } = Layout

/**
 * 主布局：侧边栏导航 + 顶部栏 + 内容区
 */
export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sidebarCollapsed, toggleSidebar, learningMode, toggleLearningMode, currentUser } = useAppStore()

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '工作台',
    },
    {
      key: 'purchase',
      icon: <ShoppingCartOutlined />,
      label: '采购管理',
      children: [
        { key: '/purchase/requests', label: '采购申请单' },
        { key: '/purchase/orders', label: '采购订单' },
        { key: '/purchase/receipts', label: '采购入库单' },
        { key: '/purchase/returns', label: '采购退货单' },
        { key: '/purchase/suppliers', label: '供应商管理' },
      ],
    },
    {
      key: 'inventory',
      icon: <InboxOutlined />,
      label: '库存管理',
      children: [
        { key: '/inventory/list', label: '库存查询' },
        { key: '/inventory/movements', label: '库存流水' },
        { key: '/inventory/stocktaking', label: '库存盘点' },
      ],
    },
    {
      key: 'finance',
      icon: <DollarOutlined />,
      label: '财务管理',
      children: [
        { key: '/finance/payables', label: '应付账款' },
        { key: '/finance/payments', label: '付款单' },
        { key: '/finance/receivables', label: '应收账款' },
        { key: '/finance/receipts', label: '收款单' },
      ],
    },
    {
      key: 'sales',
      icon: <ShoppingOutlined />,
      label: '销售管理',
      children: [
        { key: '/sales/orders', label: '销售订单' },
        { key: '/sales/deliveries', label: '销售出库单' },
        { key: '/sales/customers', label: '客户管理' },
      ],
    },
    {
      key: 'learning',
      icon: <ReadOutlined />,
      label: '学习中心',
      children: [
        { key: '/learning', label: '学习首页' },
        { key: '/learning/scenarios', label: '实战场景' },
        { key: '/learning/knowledge', label: '知识库' },
        { key: '/learning/glossary', label: '术语词典' },
        { key: '/learning/scores', label: '我的成绩' },
      ],
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '基础设置',
      children: [
        { key: '/settings/materials', label: '物料档案' },
        { key: '/settings/warehouses', label: '仓库管理' },
      ],
    },
  ]

  // 当前选中的菜单项
  const selectedKeys = [location.pathname]
  // 展开的子菜单
  const openKeys = (() => {
    const path = location.pathname
    if (path.startsWith('/purchase')) return ['purchase']
    if (path.startsWith('/inventory')) return ['inventory']
    if (path.startsWith('/finance')) return ['finance']
    if (path.startsWith('/sales')) return ['sales']
    if (path.startsWith('/learning')) return ['learning']
    if (path.startsWith('/settings')) return ['settings']
    return []
  })()

  const roleLabels = {
    admin: '管理员', buyer: '采购员', warehouse: '仓管员', finance: '财务员', sales: '销售员',
  }

  const userMenu = [
    { key: 'profile', label: '个人信息', icon: <UserOutlined /> },
    { type: 'divider' },
    { key: 'logout', label: '退出登录', danger: true },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={sidebarCollapsed}
        width={220}
        style={{ overflow: 'auto', height: '100vh', position: 'fixed', left: 0 }}
        theme="light"
      >
        {/* Logo区域 */}
        <div style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #f0f0f0',
          gap: 8,
        }}>
          <span style={{ fontSize: 24 }}>🐦</span>
          {!sidebarCollapsed && (
            <span style={{ fontSize: 16, fontWeight: 700, color: '#1677ff' }}>
              知雀ERP
            </span>
          )}
        </div>

        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>

      <Layout style={{ marginLeft: sidebarCollapsed ? 80 : 220, transition: 'margin-left 0.2s' }}>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}>
          <Space size="middle">
            {React.createElement(sidebarCollapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
              onClick: toggleSidebar,
              style: { fontSize: 18, cursor: 'pointer' },
            })}
            <span style={{ color: '#8c8c8c', fontSize: 14 }}>
              恒达精密制造有限公司
            </span>
          </Space>

          <Space size="large" align="center">
            {/* 学习模式开关 */}
            <Space size={4}>
              <ReadOutlined style={{ color: learningMode ? '#1677ff' : '#8c8c8c' }} />
              <Switch
                checked={learningMode}
                onChange={toggleLearningMode}
                checkedChildren="学习模式"
                unCheckedChildren="自由模式"
                size="small"
              />
            </Space>

            {/* 通知 */}
            <Badge count={3} size="small">
              <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
            </Badge>

            {/* 用户 */}
            <Dropdown menu={{ items: userMenu }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size="small" style={{ background: '#1677ff' }}>
                  {currentUser.real_name?.[0]}
                </Avatar>
                <span>{currentUser.real_name}</span>
                <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                  ({roleLabels[currentUser.role]})
                </span>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{
          margin: 0,
          padding: 20,
          background: '#f5f5f5',
          minHeight: 'calc(100vh - 64px)',
          overflow: 'auto',
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

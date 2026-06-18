import { create } from 'zustand'

/**
 * 全局应用状态
 */
export const useAppStore = create((set) => ({
  // 当前用户
  currentUser: {
    id: 1,
    username: 'zhangming',
    real_name: '张明',
    role: 'buyer',
    department: '采购部',
  },

  // 学习模式开关
  learningMode: true,

  // 侧边栏折叠
  sidebarCollapsed: false,

  // 当前引导课程
  activeTour: null,

  // Actions
  toggleLearningMode: () => set((state) => ({ learningMode: !state.learningMode })),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setActiveTour: (tour) => set({ activeTour: tour }),
  setCurrentUser: (user) => set({ currentUser: user }),
}))

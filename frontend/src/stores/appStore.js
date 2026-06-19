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

  // 当前引导课程状态
  activeTour: null,       // { courseId, courseName, steps, currentStep }
  tourActive: false,      // 引导是否激活中

  // Actions
  toggleLearningMode: () => set((state) => ({ learningMode: !state.learningMode })),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setActiveTour: (tour) => set({ activeTour: tour }),
  setCurrentUser: (user) => set({ currentUser: user }),

  // 启动引导课程
  startTour: (courseId, courseName, steps) => set({
    activeTour: { courseId, courseName, steps, currentStep: 0 },
    tourActive: true,
  }),

  // 下一步
  nextTourStep: () => set((state) => {
    if (!state.activeTour) return state
    const next = state.activeTour.currentStep + 1
    if (next >= state.activeTour.steps.length) {
      return { activeTour: null, tourActive: false }
    }
    return { activeTour: { ...state.activeTour, currentStep: next } }
  }),

  // 上一步
  prevTourStep: () => set((state) => {
    if (!state.activeTour) return state
    const prev = Math.max(0, state.activeTour.currentStep - 1)
    return { activeTour: { ...state.activeTour, currentStep: prev } }
  }),

  // 跳转到指定步骤
  setTourStep: (index) => set((state) => {
    if (!state.activeTour) return state
    return { activeTour: { ...state.activeTour, currentStep: index } }
  }),

  // 结束引导
  stopTour: () => set({ activeTour: null, tourActive: false }),
}))

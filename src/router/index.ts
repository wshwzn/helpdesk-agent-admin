import { createRouter, createWebHistory } from 'vue-router'

import AdminLayout from '@/components/layout/AdminLayout.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guestOnly: true } },
    {
      path: '/',
      component: AdminLayout,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/dashboard' },
        { path: 'dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: '控制台' } },
        { path: 'models', name: 'models', component: () => import('@/views/ModelConfigsView.vue'), meta: { title: '模型配置' } },
        { path: 'knowledge', name: 'knowledge', component: () => import('@/views/KnowledgeBasesView.vue'), meta: { title: '知识库' } },
        { path: 'knowledge/:id', name: 'knowledge-detail', component: () => import('@/views/KnowledgeBaseDetailView.vue'), meta: { title: '知识库详情' } },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && authStore.isAuthenticated) return { name: 'dashboard' }
  return true
})

export default router


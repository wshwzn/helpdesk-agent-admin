<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Box, DataAnalysis, Fold, House, Reading, SwitchButton } from '@element-plus/icons-vue'

import BrandLogo from '@/components/BrandLogo.vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const pageTitle = computed(() => String(route.meta.title || '管理控制台'))

/** 退出管理端并返回登录页。 */
async function logout(): Promise<void> {
  authStore.logout()
  await router.replace('/login')
}
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <div class="admin-sidebar__brand"><BrandLogo light /></div>
      <nav class="admin-nav">
        <RouterLink to="/dashboard"><el-icon><House /></el-icon><span>控制台</span></RouterLink>
        <RouterLink to="/models"><el-icon><Box /></el-icon><span>模型配置</span></RouterLink>
        <RouterLink to="/knowledge"><el-icon><Reading /></el-icon><span>知识库</span></RouterLink>
        <div class="admin-nav__soon"><el-icon><DataAnalysis /></el-icon><span>运行观测</span><em>稍后</em></div>
      </nav>
      <div class="admin-sidebar__foot">
        <span class="admin-sidebar__pulse"></span>
        <div><strong>服务已连接</strong><small>API · localhost:8080</small></div>
      </div>
    </aside>

    <section class="admin-main">
      <header class="admin-header">
        <div class="admin-header__title">
          <el-icon><Fold /></el-icon>
          <div><small>Helpdesk Agent</small><h1>{{ pageTitle }}</h1></div>
        </div>
        <el-dropdown trigger="click">
          <button class="admin-user">
            <span>{{ authStore.user?.displayName?.slice(0, 1) || '管' }}</span>
            <div><strong>{{ authStore.user?.displayName }}</strong><small>系统管理员</small></div>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item :icon="SwitchButton" @click="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </header>
      <main class="admin-content"><RouterView /></main>
    </section>
  </div>
</template>


<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { ArrowRight, Lock, User } from '@element-plus/icons-vue'

import { normalizeApiError } from '@/api/http'
import BrandLogo from '@/components/BrandLogo.vue'
import { useAuthStore } from '@/stores/auth'
import type { LoginRequest } from '@/types/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const form = reactive<LoginRequest>({ username: '', password: '' })
const rules: FormRules<LoginRequest> = {
  username: [{ required: true, message: '请输入管理员账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

/** 校验管理员身份并进入原本要访问的页面。 */
async function submitLogin(): Promise<void> {
  if (!(await formRef.value?.validate().catch(() => false))) return
  submitting.value = true
  try {
    await authStore.login(form)
    ElMessage.success('欢迎回来')
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await router.replace(redirect)
  } catch (error) {
    ElMessage.error(normalizeApiError(error).message)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="admin-login">
    <section class="admin-login__story">
      <BrandLogo light />
      <div class="admin-login__message">
        <p class="eyebrow eyebrow--light">SERVICE INTELLIGENCE</p>
        <h1>把复杂配置，<br /><em>变成清晰掌控。</em></h1>
        <p>集中管理模型与知识，让每一次智能回答都有稳定、可信的依据。</p>
      </div>
      <div class="admin-login__metrics">
        <span><strong>01</strong>模型连接</span>
        <span><strong>02</strong>知识治理</span>
        <span><strong>03</strong>召回调试</span>
      </div>
    </section>

    <section class="admin-login__panel">
      <div class="login-card">
        <p class="eyebrow">ADMIN CONSOLE</p>
        <h2>登录管理控制台</h2>
        <p class="login-card__lead">仅限管理员账号访问系统配置。</p>
        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="submitLogin">
          <el-form-item label="管理员账号" prop="username">
            <el-input v-model="form.username" size="large" :prefix-icon="User" autocomplete="username" placeholder="请输入账号" />
          </el-form-item>
          <el-form-item label="登录密码" prop="password">
            <el-input v-model="form.password" size="large" type="password" :prefix-icon="Lock" autocomplete="current-password" placeholder="请输入密码" show-password @keyup.enter="submitLogin" />
          </el-form-item>
          <el-button class="login-card__submit" type="primary" size="large" native-type="submit" :loading="submitting">
            进入控制台<el-icon><ArrowRight /></el-icon>
          </el-button>
        </el-form>
        <p class="login-card__hint">登录即表示你正在访问受保护的管理区域</p>
      </div>
    </section>
  </main>
</template>


import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { login as loginApi } from '@/api/auth'
import { ApiRequestError } from '@/api/http'
import type { AuthResponse, LoginRequest } from '@/types/auth'
import { clearAuthSession, readAuthSession, writeAuthSession } from '@/utils/auth-storage'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<AuthResponse | null>(readAuthSession())
  const isAuthenticated = computed(() => Boolean(session.value?.accessToken))
  const user = computed(() => session.value?.user ?? null)

  /** 登录并拒绝非管理员账号进入管理端。 */
  async function login(request: LoginRequest): Promise<void> {
    const response = await loginApi(request)
    if (response.user.role !== 'ADMIN') {
      throw new ApiRequestError('当前账号不是管理员，无法进入管理控制台', 'ADMIN_REQUIRED')
    }
    session.value = response
    writeAuthSession(response)
  }

  /** 退出管理员账号并清除本地会话。 */
  function logout(): void {
    session.value = null
    clearAuthSession()
  }

  return { session, isAuthenticated, user, login, logout }
})


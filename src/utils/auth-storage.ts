import type { AuthResponse } from '@/types/auth'

const AUTH_STORAGE_KEY = 'helpdesk-agent-admin.auth'

/** 从本地存储读取管理员会话，损坏或过期时自动清理。 */
export function readAuthSession(): AuthResponse | null {
  const rawSession = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!rawSession) return null
  try {
    const session = JSON.parse(rawSession) as AuthResponse
    if (session.user.role !== 'ADMIN' || new Date(session.expiresAt).getTime() <= Date.now()) {
      clearAuthSession()
      return null
    }
    return session
  } catch {
    clearAuthSession()
    return null
  }
}

/** 保存通过角色校验的管理员会话。 */
export function writeAuthSession(session: AuthResponse): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

/** 清除管理端本地登录信息。 */
export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

/** 读取当前管理员 JWT。 */
export function readAccessToken(): string | null {
  return readAuthSession()?.accessToken ?? null
}


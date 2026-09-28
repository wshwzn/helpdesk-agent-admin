import { requestData } from '@/api/http'
import type { AuthResponse, LoginRequest } from '@/types/auth'

/** 使用管理员账号登录。 */
export function login(request: LoginRequest): Promise<AuthResponse> {
  return requestData<AuthResponse>({ method: 'POST', url: '/auth/login', data: request })
}


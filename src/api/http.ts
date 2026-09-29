import axios, { type AxiosRequestConfig } from 'axios'

import type { ApiResponse } from '@/types/api'
import { clearAuthSession, readAccessToken } from '@/utils/auth-storage'

export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

export class ApiRequestError extends Error {
  readonly code: string
  readonly details: unknown

  /** 创建包含后端业务码和校验详情的请求异常。 */
  constructor(message: string, code = 'REQUEST_FAILED', details: unknown = null) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
    this.details = details
  }
}

const http = axios.create({ baseURL: apiBaseUrl, timeout: 30_000 })

http.interceptors.request.use((config) => {
  const token = readAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearAuthSession()
      if (window.location.pathname !== '/login') window.location.assign('/login')
    }
    return Promise.reject(error)
  },
)

/** 调用普通接口并提取统一响应中的业务数据。 */
export async function requestData<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await http.request<ApiResponse<T>>(config)
    if (!response.data.success) {
      throw new ApiRequestError(response.data.message, response.data.code, response.data.data)
    }
    return response.data.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

/** 调用不返回统一响应体的接口，例如删除操作。 */
export async function requestVoid(config: AxiosRequestConfig): Promise<void> {
  try {
    await http.request(config)
  } catch (error) {
    throw normalizeApiError(error)
  }
}

/** 请求受鉴权保护的二进制文件，并保留统一的异常处理行为。 */
export async function requestBlob(config: AxiosRequestConfig): Promise<Blob> {
  try {
    const response = await http.request<Blob>({ ...config, responseType: 'blob' })
    return response.data
  } catch (error) {
    throw await normalizeBlobError(error)
  }
}

/** 尝试解析二进制错误响应中的统一 JSON 异常。 */
async function normalizeBlobError(error: unknown): Promise<ApiRequestError> {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      const payload = JSON.parse(await error.response.data.text()) as ApiResponse<unknown>
      return new ApiRequestError(payload.message, payload.code, payload.data)
    } catch {
      return normalizeApiError(error)
    }
  }
  return normalizeApiError(error)
}

/** 将网络错误和后端业务异常转换为统一错误。 */
export function normalizeApiError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) return error
  if (axios.isAxiosError<ApiResponse<unknown>>(error)) {
    const payload = error.response?.data
    return new ApiRequestError(
      payload?.message || error.message || '网络请求失败，请稍后重试',
      payload?.code || `HTTP_${error.response?.status ?? 'UNKNOWN'}`,
      payload?.data,
    )
  }
  return new ApiRequestError(error instanceof Error ? error.message : '未知请求错误')
}

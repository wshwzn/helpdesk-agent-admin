import { requestData } from '@/api/http'
import type {
  ModelConfig,
  ModelConfigPayload,
  ModelConnectionTestResult,
  ModelType,
  ModelVendorOption,
} from '@/types/model'

/** 查询全部模型配置。 */
export function listModelConfigs(): Promise<ModelConfig[]> {
  return requestData({ method: 'GET', url: '/admin/model-configs' })
}

/** 按模型用途查询可用厂商。 */
export function listModelVendors(modelType: ModelType): Promise<ModelVendorOption[]> {
  return requestData({ method: 'GET', url: '/admin/model-configs/vendors', params: { modelType } })
}

/** 创建新的模型配置。 */
export function createModelConfig(payload: ModelConfigPayload): Promise<ModelConfig> {
  return requestData({ method: 'POST', url: '/admin/model-configs', data: payload })
}

/** 更新已有模型配置，未传 API Key 时保留原密钥。 */
export function updateModelConfig(id: number, payload: ModelConfigPayload): Promise<ModelConfig> {
  return requestData({ method: 'PUT', url: `/admin/model-configs/${id}`, data: payload })
}

/** 测试模型配置能否连接厂商接口。 */
export function testModelConnection(id: number): Promise<ModelConnectionTestResult> {
  return requestData({ method: 'POST', url: `/admin/model-configs/${id}/test` })
}

/** 将指定模型设为其用途下的默认模型。 */
export function setDefaultModel(id: number): Promise<ModelConfig> {
  return requestData({ method: 'POST', url: `/admin/model-configs/${id}/default` })
}

/** 启用或禁用一个模型配置。 */
export function changeModelEnabled(id: number, enabled: boolean): Promise<ModelConfig> {
  return requestData({ method: 'POST', url: `/admin/model-configs/${id}/${enabled ? 'enable' : 'disable'}` })
}


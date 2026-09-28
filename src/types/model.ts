export type ModelType = 'CHAT' | 'EMBEDDING'
export type ModelVendor = 'OPENAI' | 'DEEPSEEK' | 'QWEN' | 'OLLAMA' | 'CUSTOM'

export interface ModelConfig {
  id: number
  name: string
  modelType: ModelType
  protocol: 'OPENAI_COMPATIBLE'
  vendor: ModelVendor
  baseUrl: string
  modelName: string
  apiKeyMasked: string
  supportsStreaming: boolean
  supportsTools: boolean
  embeddingDimensions: number | null
  enabled: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface ModelVendorOption {
  code: ModelVendor
  displayName: string
  baseUrl: string | null
  customBaseUrlRequired: boolean
}

export interface ModelConfigPayload {
  name: string
  modelType?: ModelType
  vendor: ModelVendor
  baseUrl: string | null
  modelName: string
  apiKey?: string
  supportsStreaming: boolean
  supportsTools: boolean
  embeddingDimensions: number | null
  enabled?: boolean
}

export interface ModelConnectionTestResult {
  success: boolean
  message: string
}


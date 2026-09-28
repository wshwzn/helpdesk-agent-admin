<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { CircleCheck, Connection, EditPen, Plus, Promotion, Refresh } from '@element-plus/icons-vue'

import { normalizeApiError } from '@/api/http'
import {
  changeModelEnabled,
  createModelConfig,
  listModelConfigs,
  listModelVendors,
  setDefaultModel,
  testModelConnection,
  updateModelConfig,
} from '@/api/model-config'
import type { ModelConfig, ModelConfigPayload, ModelType, ModelVendor, ModelVendorOption } from '@/types/model'
import { formatDateTime } from '@/utils/format'

interface ModelForm {
  id: number | null
  name: string
  modelType: ModelType
  vendor: ModelVendor
  baseUrl: string
  modelName: string
  apiKey: string
  supportsStreaming: boolean
  supportsTools: boolean
  embeddingDimensions: number | null
  enabled: boolean
}

const typeLabels: Record<ModelType, string> = { CHAT: '对话模型', EMBEDDING: '向量模型' }
const loading = ref(false)
const saving = ref(false)
const testingId = ref<number | null>(null)
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const models = ref<ModelConfig[]>([])
const vendorOptions = ref<ModelVendorOption[]>([])
const activeType = ref<'ALL' | ModelType>('ALL')
const form = reactive<ModelForm>(emptyForm())
const displayedModels = computed(() => activeType.value === 'ALL'
  ? models.value
  : models.value.filter((item) => item.modelType === activeType.value))
const formRules: FormRules<ModelForm> = {
  name: [{ required: true, message: '请输入配置名称', trigger: 'blur' }],
  modelName: [{ required: true, message: '请输入厂商模型名称', trigger: 'blur' }],
  vendor: [{ required: true, message: '请选择模型厂商', trigger: 'change' }],
  apiKey: [{ validator: (_rule, value, callback) => {
    if (!form.id && !value) callback(new Error('新建配置必须填写 API Key'))
    else callback()
  }, trigger: 'blur' }],
  baseUrl: [{ validator: (_rule, value, callback) => {
    const current = vendorOptions.value.find((item) => item.code === form.vendor)
    if (current?.customBaseUrlRequired && !value) callback(new Error('自定义厂商必须填写基础地址'))
    else callback()
  }, trigger: 'blur' }],
}

/** 创建一份干净的模型表单数据。 */
function emptyForm(): ModelForm {
  return {
    id: null, name: '', modelType: 'CHAT', vendor: 'DEEPSEEK', baseUrl: '', modelName: '', apiKey: '',
    supportsStreaming: true, supportsTools: true, embeddingDimensions: null, enabled: true,
  }
}

/** 读取模型配置列表。 */
async function loadModels(): Promise<void> {
  loading.value = true
  try {
    models.value = await listModelConfigs()
  } catch (error) {
    ElMessage.error(normalizeApiError(error).message)
  } finally {
    loading.value = false
  }
}

/** 打开新建模型对话框并加载聊天模型厂商。 */
async function openCreate(): Promise<void> {
  Object.assign(form, emptyForm())
  await loadVendors('CHAT')
  dialogVisible.value = true
}

/** 打开编辑对话框并回填非敏感配置。 */
async function openEdit(item: ModelConfig): Promise<void> {
  await loadVendors(item.modelType)
  Object.assign(form, {
    id: item.id,
    name: item.name,
    modelType: item.modelType,
    vendor: item.vendor,
    baseUrl: item.baseUrl,
    modelName: item.modelName,
    apiKey: '',
    supportsStreaming: item.supportsStreaming,
    supportsTools: item.supportsTools,
    embeddingDimensions: item.embeddingDimensions,
    enabled: item.enabled,
  })
  dialogVisible.value = true
}

/** 加载指定用途允许选择的模型厂商。 */
async function loadVendors(modelType: ModelType): Promise<void> {
  vendorOptions.value = await listModelVendors(modelType)
}

/** 切换模型用途并清理不适用的能力字段。 */
async function handleTypeChange(modelType: ModelType): Promise<void> {
  await loadVendors(modelType)
  if (modelType === 'EMBEDDING') {
    form.vendor = 'CUSTOM'
    form.supportsStreaming = false
    form.supportsTools = false
  } else {
    form.vendor = vendorOptions.value[0]?.code ?? 'CUSTOM'
    form.embeddingDimensions = null
  }
  handleVendorChange(form.vendor)
}

/** 选择厂商后回显预设地址，自定义厂商保留输入框。 */
function handleVendorChange(vendor: ModelVendor): void {
  const option = vendorOptions.value.find((item) => item.code === vendor)
  form.baseUrl = option?.baseUrl ?? ''
}

/** 创建或更新模型配置。 */
async function saveModel(): Promise<void> {
  if (!(await formRef.value?.validate().catch(() => false))) return
  saving.value = true
  const payload: ModelConfigPayload = {
    name: form.name.trim(),
    modelType: form.modelType,
    vendor: form.vendor,
    baseUrl: form.baseUrl.trim() || null,
    modelName: form.modelName.trim(),
    supportsStreaming: form.modelType === 'CHAT' && form.supportsStreaming,
    supportsTools: form.modelType === 'CHAT' && form.supportsTools,
    embeddingDimensions: form.modelType === 'EMBEDDING' ? form.embeddingDimensions : null,
  }
  if (form.apiKey) payload.apiKey = form.apiKey
  try {
    if (form.id) await updateModelConfig(form.id, payload)
    else await createModelConfig({ ...payload, apiKey: form.apiKey, enabled: form.enabled })
    ElMessage.success(form.id ? '模型配置已更新' : '模型配置已创建')
    dialogVisible.value = false
    await loadModels()
  } catch (error) {
    ElMessage.error(normalizeApiError(error).message)
  } finally {
    saving.value = false
  }
}

/** 请求后端实际调用一次模型以验证连接。 */
async function testConnection(item: ModelConfig): Promise<void> {
  testingId.value = item.id
  try {
    const result = await testModelConnection(item.id)
    result.success ? ElMessage.success(result.message) : ElMessage.warning(result.message)
  } catch (error) {
    ElMessage.error(normalizeApiError(error).message)
  } finally {
    testingId.value = null
  }
}

/** 将启用的模型设置为当前用途的默认项。 */
async function makeDefault(item: ModelConfig): Promise<void> {
  try {
    await setDefaultModel(item.id)
    ElMessage.success(`已设为默认${typeLabels[item.modelType]}`)
    await loadModels()
  } catch (error) {
    ElMessage.error(normalizeApiError(error).message)
  }
}

/** 二次确认后切换模型启用状态。 */
async function toggleEnabled(item: ModelConfig): Promise<void> {
  const action = item.enabled ? '禁用' : '启用'
  try {
    await ElMessageBox.confirm(`确定${action}“${item.name}”吗？`, `${action}模型`, { type: 'warning' })
    await changeModelEnabled(item.id, !item.enabled)
    ElMessage.success(`模型已${action}`)
    await loadModels()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(normalizeApiError(error).message)
  }
}

onMounted(loadModels)
</script>

<template>
  <div class="page-stack">
    <section class="page-heading">
      <div><p class="eyebrow">MODEL REGISTRY</p><h2>模型配置</h2><p>统一管理 OpenAI 兼容的对话与向量模型。</p></div>
      <el-button type="primary" :icon="Plus" @click="openCreate">添加模型</el-button>
    </section>

    <section class="surface-card">
      <div class="toolbar-row">
        <el-segmented v-model="activeType" :options="[{ label: '全部', value: 'ALL' }, { label: '对话模型', value: 'CHAT' }, { label: '向量模型', value: 'EMBEDDING' }]" />
        <el-button :icon="Refresh" circle @click="loadModels" />
      </div>
      <div v-loading="loading" class="model-grid">
        <article v-for="item in displayedModels" :key="item.id" class="model-card">
          <header>
            <span class="model-card__logo" :class="`model-card__logo--${item.modelType.toLowerCase()}`">{{ item.modelType === 'CHAT' ? 'AI' : 'E' }}</span>
            <div><strong>{{ item.name }}</strong><small>{{ typeLabels[item.modelType] }} · {{ item.vendor }}</small></div>
            <el-tag v-if="item.isDefault" type="success" effect="light" round>默认</el-tag>
          </header>
          <dl>
            <div><dt>模型名称</dt><dd>{{ item.modelName }}</dd></div>
            <div><dt>接口地址</dt><dd :title="item.baseUrl">{{ item.baseUrl }}</dd></div>
            <div><dt>访问密钥</dt><dd>{{ item.apiKeyMasked }}</dd></div>
            <div v-if="item.modelType === 'EMBEDDING'"><dt>向量维度</dt><dd>{{ item.embeddingDimensions }}</dd></div>
          </dl>
          <div class="model-card__capabilities">
            <el-tag size="small" :type="item.enabled ? 'success' : 'info'">{{ item.enabled ? '已启用' : '已禁用' }}</el-tag>
            <el-tag v-if="item.supportsStreaming" size="small" type="primary">流式</el-tag>
            <el-tag v-if="item.supportsTools" size="small" type="warning">工具调用</el-tag>
            <span>{{ formatDateTime(item.updatedAt) }}</span>
          </div>
          <footer>
            <el-button text :icon="Connection" :loading="testingId === item.id" @click="testConnection(item)">测试</el-button>
            <el-button text :icon="EditPen" @click="openEdit(item)">编辑</el-button>
            <el-button v-if="!item.isDefault" text :icon="Promotion" :disabled="!item.enabled" @click="makeDefault(item)">设为默认</el-button>
            <el-button text :type="item.enabled ? 'danger' : 'success'" @click="toggleEnabled(item)">{{ item.enabled ? '禁用' : '启用' }}</el-button>
          </footer>
        </article>
        <el-empty v-if="!loading && !displayedModels.length" description="暂无模型配置" />
      </div>
    </section>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑模型配置' : '添加模型配置'" width="620px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-position="top" class="dialog-form">
        <div class="form-grid">
          <el-form-item label="配置名称" prop="name"><el-input v-model="form.name" placeholder="例如：DeepSeek 主模型" /></el-form-item>
          <el-form-item label="模型用途" prop="modelType"><el-select v-model="form.modelType" :disabled="Boolean(form.id)" @change="handleTypeChange"><el-option label="对话模型" value="CHAT" /><el-option label="向量模型" value="EMBEDDING" /></el-select></el-form-item>
          <el-form-item label="模型厂商" prop="vendor"><el-select v-model="form.vendor" @change="handleVendorChange"><el-option v-for="item in vendorOptions" :key="item.code" :label="item.displayName" :value="item.code" /></el-select></el-form-item>
          <el-form-item label="厂商模型名称" prop="modelName"><el-input v-model="form.modelName" placeholder="例如：deepseek-chat" /></el-form-item>
        </div>
        <el-form-item label="基础地址" prop="baseUrl"><el-input v-model="form.baseUrl" :disabled="form.vendor !== 'CUSTOM'" placeholder="https://example.com/v1" /></el-form-item>
        <el-form-item :label="form.id ? 'API Key（留空则保持不变）' : 'API Key'" prop="apiKey"><el-input v-model="form.apiKey" type="password" show-password autocomplete="new-password" /></el-form-item>
        <el-form-item v-if="form.modelType === 'EMBEDDING'" label="向量维度" prop="embeddingDimensions"><el-input-number v-model="form.embeddingDimensions" :min="1" :max="4096" controls-position="right" /></el-form-item>
        <div v-else class="capability-row"><el-checkbox v-model="form.supportsStreaming">支持流式输出</el-checkbox><el-checkbox v-model="form.supportsTools">支持工具调用</el-checkbox></div>
        <el-checkbox v-if="!form.id" v-model="form.enabled">创建后立即启用</el-checkbox>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" :icon="CircleCheck" :loading="saving" @click="saveModel">保存配置</el-button></template>
    </el-dialog>
  </div>
</template>


<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules, type UploadRequestOptions } from 'element-plus'
import { Back, Delete, DocumentAdd, Refresh, Search, Setting, UploadFilled, View } from '@element-plus/icons-vue'

import { normalizeApiError } from '@/api/http'
import {
  deleteKnowledgeDocument,
  getKnowledgeBase,
  indexKnowledgeDocument,
  listKnowledgeDocuments,
  previewDocumentChunks,
  searchKnowledgeBase,
  updateRetrievalSettings,
  uploadKnowledgeDocument,
} from '@/api/knowledge'
import type { DocumentChunkPreview, KnowledgeBase, KnowledgeDocument, KnowledgeSearchResponse, RetrievalSettingsPayload } from '@/types/knowledge'
import { formatBytes, formatDateTime } from '@/utils/format'

const statusLabels = { UPLOADING: '上传中', PENDING: '待索引', PROCESSING: '处理中', READY: '已就绪', FAILED: '失败' }
const statusTypes = { UPLOADING: 'info', PENDING: 'warning', PROCESSING: 'primary', READY: 'success', FAILED: 'danger' } as const
const route = useRoute()
const router = useRouter()
const knowledgeBaseId = Number(route.params.id)
const loading = ref(true)
const documentLoading = ref(false)
const uploading = ref(false)
const savingSettings = ref(false)
const searching = ref(false)
const actionDocumentId = ref<number | null>(null)
const activeTab = ref('documents')
const knowledgeBase = ref<KnowledgeBase | null>(null)
const documents = ref<KnowledgeDocument[]>([])
const documentPage = ref(1)
const documentTotal = ref(0)
const preview = ref<DocumentChunkPreview | null>(null)
const previewVisible = ref(false)
const searchQuery = ref('')
const searchResponse = ref<KnowledgeSearchResponse | null>(null)
const settingsFormRef = ref<FormInstance>()
const thresholdEnabled = ref(false)
const settings = reactive<RetrievalSettingsPayload>({ candidateLimit: 50, vectorMinSimilarity: null, resultLimit: 5 })
let pollingTimer: number | undefined
const settingsRules: FormRules<RetrievalSettingsPayload> = {
  resultLimit: [{ validator: (_rule, value, callback) => {
    if (Number(value) > settings.candidateLimit) callback(new Error('最终结果数不能超过单路候选数'))
    else callback()
  }, trigger: 'change' }],
}
const hasProcessingDocument = computed(() => documents.value.some((item) => item.status === 'PROCESSING' || item.status === 'UPLOADING'))

/** 加载知识库详情并回填当前检索参数。 */
async function loadKnowledgeBase(): Promise<void> {
  knowledgeBase.value = await getKnowledgeBase(knowledgeBaseId)
  settings.candidateLimit = knowledgeBase.value.retrievalCandidateLimit
  settings.vectorMinSimilarity = knowledgeBase.value.vectorMinSimilarity
  settings.resultLimit = knowledgeBase.value.retrievalResultLimit
  thresholdEnabled.value = knowledgeBase.value.vectorMinSimilarity !== null
}

/** 加载当前页文档，并在存在处理中任务时继续轮询。 */
async function loadDocuments(): Promise<void> {
  documentLoading.value = true
  try {
    const result = await listKnowledgeDocuments(knowledgeBaseId, documentPage.value, 20)
    documents.value = result.records
    documentTotal.value = result.total
    scheduleDocumentPolling()
  } catch (error) {
    ElMessage.error(normalizeApiError(error).message)
  } finally {
    documentLoading.value = false
  }
}

/** 仅在后台仍有文档处理时安排下一次状态刷新。 */
function scheduleDocumentPolling(): void {
  if (pollingTimer) window.clearTimeout(pollingTimer)
  pollingTimer = undefined
  if (hasProcessingDocument.value) pollingTimer = window.setTimeout(loadDocuments, 2500)
}

/** 初始化详情页所需数据。 */
async function initialize(): Promise<void> {
  if (!Number.isInteger(knowledgeBaseId) || knowledgeBaseId < 1) {
    await router.replace('/knowledge')
    return
  }
  loading.value = true
  try {
    await Promise.all([loadKnowledgeBase(), loadDocuments()])
  } catch (error) {
    ElMessage.error(normalizeApiError(error).message)
    await router.replace('/knowledge')
  } finally {
    loading.value = false
  }
}

/** 接管 Element Plus 上传请求并保存单个知识文档。 */
async function handleUpload(options: UploadRequestOptions): Promise<void> {
  uploading.value = true
  try {
    await uploadKnowledgeDocument(knowledgeBaseId, options.file)
    ElMessage.success('文档上传成功，可以开始索引')
    await Promise.all([loadKnowledgeBase(), loadDocuments()])
    options.onSuccess({})
  } catch (error) {
    const normalized = normalizeApiError(error)
    ElMessage.error(normalized.message)
    throw normalized
  } finally {
    uploading.value = false
  }
}

/** 触发文档解析、向量化和索引。 */
async function startIndexing(item: KnowledgeDocument): Promise<void> {
  actionDocumentId.value = item.id
  try {
    await indexKnowledgeDocument(knowledgeBaseId, item.id)
    ElMessage.success('索引任务已开始')
    await loadDocuments()
  } catch (error) {
    ElMessage.error(normalizeApiError(error).message)
  } finally {
    actionDocumentId.value = null
  }
}

/** 解析文档并展示分块预览结果。 */
async function showPreview(item: KnowledgeDocument): Promise<void> {
  actionDocumentId.value = item.id
  try {
    preview.value = await previewDocumentChunks(knowledgeBaseId, item.id)
    previewVisible.value = true
  } catch (error) {
    ElMessage.error(normalizeApiError(error).message)
  } finally {
    actionDocumentId.value = null
  }
}

/** 二次确认后删除文档。 */
async function removeDocument(item: KnowledgeDocument): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除“${item.originalName}”吗？`, '删除文档', { type: 'warning' })
    await deleteKnowledgeDocument(knowledgeBaseId, item.id)
    ElMessage.success('文档已删除')
    await Promise.all([loadKnowledgeBase(), loadDocuments()])
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(normalizeApiError(error).message)
  }
}

/** 保存知识库级检索参数，相似度开关关闭时提交空值。 */
async function saveSettings(): Promise<void> {
  if (!(await settingsFormRef.value?.validate().catch(() => false))) return
  savingSettings.value = true
  try {
    await updateRetrievalSettings(knowledgeBaseId, {
      candidateLimit: settings.candidateLimit,
      vectorMinSimilarity: thresholdEnabled.value ? settings.vectorMinSimilarity : null,
      resultLimit: settings.resultLimit,
    })
    ElMessage.success('检索参数已保存，下次查询立即生效')
    await loadKnowledgeBase()
  } catch (error) {
    ElMessage.error(normalizeApiError(error).message)
  } finally {
    savingSettings.value = false
  }
}

/** 启用相似度过滤时填入便于继续调整的推荐初始值。 */
function handleThresholdToggle(enabled: boolean): void {
  if (enabled && settings.vectorMinSimilarity === null) settings.vectorMinSimilarity = 0.65
}

/** 执行 BM25 与向量双路召回并显示融合结果。 */
async function runSearch(): Promise<void> {
  const query = searchQuery.value.trim()
  if (!query) {
    ElMessage.warning('请输入测试问题')
    return
  }
  searching.value = true
  try {
    searchResponse.value = await searchKnowledgeBase(knowledgeBaseId, query)
  } catch (error) {
    ElMessage.error(normalizeApiError(error).message)
  } finally {
    searching.value = false
  }
}

onMounted(initialize)
onBeforeUnmount(() => { if (pollingTimer) window.clearTimeout(pollingTimer) })
</script>

<template>
  <div v-loading="loading" class="page-stack">
    <section class="detail-heading">
      <button class="back-button" @click="router.push('/knowledge')"><el-icon><Back /></el-icon></button>
      <div><p class="eyebrow">KNOWLEDGE SPACE</p><h2>{{ knowledgeBase?.name || '知识库详情' }}</h2><p>{{ knowledgeBase?.description || '管理文档、检索策略与召回效果。' }}</p></div>
      <div class="detail-heading__meta"><span><strong>{{ knowledgeBase?.documentCount || 0 }}</strong>文档</span><span><strong>{{ knowledgeBase?.retrievalResultLimit || 5 }}</strong>返回结果</span></div>
    </section>

    <section class="surface-card detail-workspace">
      <el-tabs v-model="activeTab">
        <el-tab-pane name="documents"><template #label><el-icon><DocumentAdd /></el-icon>文档管理</template>
          <div class="tab-toolbar"><div><h3>知识文档</h3><p>支持 TXT、Markdown、PDF 和 Word，单文件最大 20 MB。</p></div><el-upload :show-file-list="false" :http-request="handleUpload" accept=".txt,.md,.pdf,.docx"><el-button type="primary" :icon="UploadFilled" :loading="uploading">上传文档</el-button></el-upload></div>
          <el-table v-loading="documentLoading" :data="documents" class="admin-table">
            <el-table-column label="文档"><template #default="{ row }"><div class="document-name"><span>{{ row.fileExtension.toUpperCase() }}</span><div><strong>{{ row.originalName }}</strong><small>{{ formatBytes(row.sizeBytes) }} · {{ formatDateTime(row.createdAt) }}</small></div></div></template></el-table-column>
            <el-table-column label="状态" width="120"><template #default="{ row }"><el-tag :type="statusTypes[row.status as keyof typeof statusTypes]" effect="light" round>{{ statusLabels[row.status as keyof typeof statusLabels] }}</el-tag></template></el-table-column>
            <el-table-column prop="chunkCount" label="分块数" width="90" />
            <el-table-column label="操作" width="290" align="right"><template #default="{ row }"><el-button text :icon="View" :loading="actionDocumentId === row.id" :disabled="row.status === 'PROCESSING'" @click="showPreview(row)">预览</el-button><el-button text type="primary" :icon="Refresh" :loading="actionDocumentId === row.id" :disabled="row.status === 'PROCESSING'" @click="startIndexing(row)">{{ row.status === 'READY' ? '重新索引' : '开始索引' }}</el-button><el-button text type="danger" :icon="Delete" :disabled="row.status === 'PROCESSING'" @click="removeDocument(row)">删除</el-button></template></el-table-column>
            <template #empty><el-empty description="还没有上传文档" :image-size="70" /></template>
          </el-table>
          <el-pagination v-if="documentTotal > 20" v-model:current-page="documentPage" layout="prev, pager, next" :total="documentTotal" :page-size="20" @current-change="loadDocuments" />
        </el-tab-pane>

        <el-tab-pane name="settings"><template #label><el-icon><Setting /></el-icon>检索参数</template>
          <div class="settings-layout">
            <el-form ref="settingsFormRef" :model="settings" :rules="settingsRules" label-position="top" class="settings-form">
              <div class="settings-field"><div><strong>单路候选数量上限</strong><p>BM25 和 KNN 各自送入 RRF 的最大结果数。</p></div><el-form-item prop="candidateLimit"><el-input-number v-model="settings.candidateLimit" :min="1" :max="200" controls-position="right" /></el-form-item></div>
              <div class="settings-field"><div><strong>向量相似度下限</strong><p>过滤语义相关度不足的结果，关闭时不限制。</p></div><div class="settings-field__control"><el-switch v-model="thresholdEnabled" active-text="启用" inactive-text="关闭" @change="handleThresholdToggle" /><el-input-number v-if="thresholdEnabled" v-model="settings.vectorMinSimilarity" :min="0" :max="1" :step="0.05" :precision="3" controls-position="right" /></div></div>
              <div class="settings-field"><div><strong>最终结果数量上限</strong><p>RRF 融合去重后交给上层使用的最大结果数。</p></div><el-form-item prop="resultLimit"><el-input-number v-model="settings.resultLimit" :min="1" :max="50" controls-position="right" /></el-form-item></div>
              <div class="settings-note"><strong>固定策略</strong><p>KNN 的 num_candidates 自动使用单路候选数的 2 倍，无需单独维护。</p></div>
              <el-button type="primary" :loading="savingSettings" @click="saveSettings">保存检索参数</el-button>
            </el-form>
            <aside class="settings-guide"><p class="eyebrow">TUNING GUIDE</p><h3>怎么调整？</h3><ul><li><strong>先调最终数量</strong><span>决定模型最终能看到多少段资料。</span></li><li><strong>再调相似度阈值</strong><span>结果噪声大就提高，漏召回则降低。</span></li><li><strong>最后扩大候选</strong><span>知识量大且融合排序不稳定时再增加。</span></li></ul></aside>
          </div>
        </el-tab-pane>

        <el-tab-pane name="search"><template #label><el-icon><Search /></el-icon>召回测试</template>
          <div class="search-console">
            <header><p class="eyebrow">RETRIEVAL LAB</p><h3>验证问题能否找到正确资料</h3><p>一次请求同时执行全文与向量检索，并展示 RRF 融合后的排名依据。</p></header>
            <div class="search-box"><el-input v-model="searchQuery" size="large" placeholder="输入一个真实客户可能提出的问题" clearable @keyup.enter="runSearch" /><el-button type="primary" :icon="Search" :loading="searching" @click="runSearch">开始检索</el-button></div>
            <div v-if="searchResponse" class="search-summary"><span>BM25 候选 <strong>{{ searchResponse.bm25CandidateCount }}</strong></span><span>向量候选 <strong>{{ searchResponse.vectorCandidateCount }}</strong></span><span>融合结果 <strong>{{ searchResponse.results.length }}</strong></span><span>相似度下限 <strong>{{ searchResponse.vectorMinSimilarity ?? '关闭' }}</strong></span></div>
            <div v-if="searchResponse?.results.length" class="search-results">
              <article v-for="item in searchResponse.results" :key="`${item.documentId}-${item.chunkSequence}`"><span class="search-results__rank">{{ item.rank }}</span><div class="search-results__body"><header><strong>{{ item.originalName }}</strong><small>文档 #{{ item.documentId }} · Chunk {{ item.chunkSequence }}</small></header><p>{{ item.content }}</p><footer><el-tag size="small">RRF {{ item.rrfScore.toFixed(4) }}</el-tag><el-tag v-if="item.bm25Rank" size="small" type="warning">BM25 #{{ item.bm25Rank }} · {{ item.bm25Score?.toFixed(3) }}</el-tag><el-tag v-if="item.vectorRank" size="small" type="success">向量 #{{ item.vectorRank }} · {{ item.vectorScore?.toFixed(3) }}</el-tag></footer></div></article>
            </div>
            <el-empty v-else-if="searchResponse" description="没有召回结果，请尝试降低阈值或更换问题" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-drawer v-model="previewVisible" title="文档分块预览" size="620px">
      <div v-if="preview" class="preview-drawer"><div class="preview-stats"><span><strong>{{ preview.extractedCharacters }}</strong>正文字符</span><span><strong>{{ preview.totalChunks }}</strong>个分块</span><span><strong>{{ preview.chunkSize }}</strong>最大字符</span><span><strong>{{ preview.chunkOverlap }}</strong>重叠字符</span></div><article v-for="chunk in preview.chunks" :key="chunk.sequence"><header><strong>Chunk {{ chunk.sequence }}</strong><small>{{ chunk.startOffset }}–{{ chunk.endOffset }} · {{ chunk.characterCount }} 字符</small></header><p>{{ chunk.content }}</p></article></div>
    </el-drawer>
  </div>
</template>

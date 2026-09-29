<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules, type TableInstance, type UploadFile, type UploadFiles, type UploadUserFile } from 'element-plus'
import { Back, DataAnalysis, Delete, Document, DocumentAdd, Refresh, Search, Setting, UploadFilled, View } from '@element-plus/icons-vue'

import { normalizeApiError } from '@/api/http'
import RagEvaluationPanel from '@/components/knowledge/RagEvaluationPanel.vue'
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
import type { DocumentChunkPreview, KnowledgeBase, KnowledgeDocument, KnowledgeSearchResponse, KnowledgeSearchResult, RetrievalSettingsPayload } from '@/types/knowledge'
import { formatBytes, formatCosineScorePercent, formatDateTime, formatSimilarityPercent } from '@/utils/format'

const statusLabels = { UPLOADING: '上传中', PENDING: '待索引', PROCESSING: '处理中', READY: '已就绪', FAILED: '失败' }
const statusTypes = { UPLOADING: 'info', PENDING: 'warning', PROCESSING: 'primary', READY: 'success', FAILED: 'danger' } as const
const route = useRoute()
const router = useRouter()
const knowledgeBaseId = Number(route.params.id)
const loading = ref(true)
const documentLoading = ref(false)
const uploadDialogVisible = ref(false)
const batchUploading = ref(false)
const uploadFiles = ref<UploadUserFile[]>([])
const savingSettings = ref(false)
const searching = ref(false)
const batchIndexing = ref(false)
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
const selectedSearchResult = ref<KnowledgeSearchResult | null>(null)
const searchDetailVisible = ref(false)
const settingsFormRef = ref<FormInstance>()
const documentTableRef = ref<TableInstance>()
const selectedDocuments = ref<KnowledgeDocument[]>([])
const vectorSimilarityPercent = ref(0)
const settings = reactive<RetrievalSettingsPayload>({ candidateLimit: 50, vectorMinSimilarity: 0, resultLimit: 5 })
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
  vectorSimilarityPercent.value = Math.round(knowledgeBase.value.vectorMinSimilarity * 1000) / 10
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

/** 打开批量上传弹窗，并清空上一次已经完成的选择。 */
function openUploadDialog(): void {
  uploadFiles.value = []
  uploadDialogVisible.value = true
}

/** 在文件加入队列时校验类型和 20 MB 大小限制，拖拽文件也执行相同检查。 */
function validateUploadFile(file: UploadFile, files: UploadFiles): void {
  const raw = file.raw
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const invalidType = !['txt', 'md', 'pdf', 'docx'].includes(extension)
  const tooLarge = Boolean(raw && raw.size > 20 * 1024 * 1024)
  if (!invalidType && !tooLarge) return
  uploadFiles.value = files.filter((item) => item.uid !== file.uid)
  ElMessage.warning(invalidType ? `${file.name} 的格式不受支持` : `${file.name} 超过 20 MB`)
}

/** 提示单批文件数量限制，避免一次操作占用过多浏览器和服务端资源。 */
function handleUploadExceed(): void {
  ElMessage.warning('单次最多添加 20 个文档')
}

/** 逐个上传队列中的文档，使单个失败不会中断其他文件或造成瞬时内存压力。 */
async function uploadSelectedFiles(): Promise<void> {
  const queue = uploadFiles.value.filter((item) => item.status === 'ready' || item.status === 'fail')
  if (queue.length === 0) {
    ElMessage.warning('请先选择或拖入文档')
    return
  }
  batchUploading.value = true
  let succeeded = 0
  let failed = 0
  let firstFailureMessage = ''
  try {
    for (const item of queue) {
      if (!item.raw) continue
      item.status = 'uploading'
      item.percentage = 0
      try {
        await uploadKnowledgeDocument(knowledgeBaseId, item.raw)
        item.status = 'success'
        item.percentage = 100
        succeeded += 1
      } catch (error) {
        item.status = 'fail'
        failed += 1
        if (!firstFailureMessage) firstFailureMessage = normalizeApiError(error).message
      }
    }
    if (succeeded > 0) await Promise.all([loadKnowledgeBase(), loadDocuments()])
    if (failed === 0) {
      ElMessage.success(`已上传 ${succeeded} 个文档，可以开始索引`)
      uploadDialogVisible.value = false
      uploadFiles.value = []
    } else {
      ElMessage.warning(`上传完成：成功 ${succeeded} 个，失败 ${failed} 个；${firstFailureMessage}`)
      uploadFiles.value = uploadFiles.value.filter((item) => item.status === 'fail')
    }
  } finally {
    batchUploading.value = false
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

/** 限制批量选择范围，防止误重建已就绪文档或重复提交处理中的任务。 */
function canBatchIndex(item: KnowledgeDocument): boolean {
  return item.status === 'PENDING' || item.status === 'FAILED'
}

/** 同步表格勾选结果，作为本次批量索引的文档队列。 */
function handleDocumentSelectionChange(selection: KnowledgeDocument[]): void {
  selectedDocuments.value = selection
}

/** 依次触发所选文档的异步索引，单个失败不影响队列中的其他文档。 */
async function startBatchIndexing(): Promise<void> {
  const queue = selectedDocuments.value.filter(canBatchIndex)
  if (queue.length === 0) {
    ElMessage.warning('请先勾选待索引或索引失败的文档')
    return
  }
  batchIndexing.value = true
  let succeeded = 0
  let failed = 0
  let firstFailureMessage = ''
  try {
    for (const item of queue) {
      actionDocumentId.value = item.id
      try {
        await indexKnowledgeDocument(knowledgeBaseId, item.id)
        succeeded += 1
      } catch (error) {
        failed += 1
        if (!firstFailureMessage) firstFailureMessage = normalizeApiError(error).message
      }
    }
    documentTableRef.value?.clearSelection()
    selectedDocuments.value = []
    await loadDocuments()
    if (failed === 0) ElMessage.success(`已启动 ${succeeded} 个文档的索引任务`)
    else ElMessage.warning(`批量索引已提交：成功 ${succeeded} 个，失败 ${failed} 个；${firstFailureMessage}`)
  } finally {
    actionDocumentId.value = null
    batchIndexing.value = false
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

/** 在新的管理端标签页中打开受鉴权保护的原始文档预览。 */
function openOriginalDocument(item: KnowledgeDocument): void {
  const target = router.resolve({
    name: 'knowledge-document-original',
    params: { id: knowledgeBaseId, documentId: item.id },
  })
  window.open(target.href, '_blank', 'noopener,noreferrer')
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

/** 保存知识库级检索参数，并将百分数阈值转换为后端小数。 */
async function saveSettings(): Promise<void> {
  if (!(await settingsFormRef.value?.validate().catch(() => false))) return
  savingSettings.value = true
  try {
    await updateRetrievalSettings(knowledgeBaseId, {
      candidateLimit: settings.candidateLimit,
      vectorMinSimilarity: vectorSimilarityPercent.value / 100,
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

/** 候选上限降低时同步收紧最终结果数量，保持参数关系合法。 */
function handleCandidateLimitChange(value: number): void {
  if (settings.resultLimit > value) settings.resultLimit = Math.min(value, 50)
}

/** 为相似度滑杆的浮层补充百分号。 */
function formatSliderPercent(value: number): string {
  return `${Number(value.toFixed(1))}%`
}

/** 打开选中 Chunk 的完整内容与召回得分详情。 */
function showSearchResultDetail(item: KnowledgeSearchResult): void {
  selectedSearchResult.value = item
  searchDetailVisible.value = true
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
          <div class="tab-toolbar"><div><h3>知识文档</h3><p>勾选待索引或失败文档可批量开始索引；已就绪文档仍可单独重新索引。</p></div><div class="tab-toolbar__actions"><el-button :icon="Refresh" :loading="batchIndexing" :disabled="selectedDocuments.length === 0" @click="startBatchIndexing">批量开始索引{{ selectedDocuments.length > 0 ? `（${selectedDocuments.length}）` : '' }}</el-button><el-button type="primary" :icon="UploadFilled" :disabled="batchIndexing" @click="openUploadDialog">批量上传</el-button></div></div>
          <el-table ref="documentTableRef" v-loading="documentLoading" :data="documents" class="admin-table" @selection-change="handleDocumentSelectionChange">
            <el-table-column type="selection" width="46" :selectable="canBatchIndex" />
            <el-table-column label="文档"><template #default="{ row }"><div class="document-name"><span>{{ row.fileExtension.toUpperCase() }}</span><div><strong>{{ row.originalName }}</strong><small>{{ formatBytes(row.sizeBytes) }} · {{ formatDateTime(row.createdAt) }}</small></div></div></template></el-table-column>
            <el-table-column label="状态" width="120"><template #default="{ row }"><el-tag :type="statusTypes[row.status as keyof typeof statusTypes]" effect="light" round>{{ statusLabels[row.status as keyof typeof statusLabels] }}</el-tag></template></el-table-column>
            <el-table-column prop="chunkCount" label="分块数" width="90" />
            <el-table-column label="操作" width="410" align="right"><template #default="{ row }"><el-button text :icon="Document" :disabled="batchIndexing" @click="openOriginalDocument(row)">查看原文</el-button><el-button text :icon="View" :loading="!batchIndexing && actionDocumentId === row.id" :disabled="batchIndexing || row.status === 'PROCESSING'" @click="showPreview(row)">分块预览</el-button><el-button text type="primary" :icon="Refresh" :loading="!batchIndexing && actionDocumentId === row.id" :disabled="batchIndexing || row.status === 'PROCESSING'" @click="startIndexing(row)">{{ row.status === 'READY' ? '重新索引' : '开始索引' }}</el-button><el-button text type="danger" :icon="Delete" :disabled="batchIndexing || row.status === 'PROCESSING'" @click="removeDocument(row)">删除</el-button></template></el-table-column>
            <template #empty><el-empty description="还没有上传文档" :image-size="70" /></template>
          </el-table>
          <el-pagination v-if="documentTotal > 20" v-model:current-page="documentPage" layout="prev, pager, next" :total="documentTotal" :page-size="20" @current-change="loadDocuments" />
        </el-tab-pane>

        <el-tab-pane name="settings"><template #label><el-icon><Setting /></el-icon>检索参数</template>
          <div class="settings-layout">
            <el-form ref="settingsFormRef" :model="settings" :rules="settingsRules" label-position="top" class="settings-form">
              <div class="settings-field settings-field--slider"><div class="settings-field__label"><strong>单路候选数量上限</strong><p>BM25 和 KNN 各自送入 RRF 的最大结果数。</p></div><el-form-item prop="candidateLimit" class="settings-field__slider"><el-slider v-model="settings.candidateLimit" :min="1" :max="200" :step="1" show-input @change="handleCandidateLimitChange" /></el-form-item></div>
              <div class="settings-field settings-field--slider"><div class="settings-field__label"><strong>向量相似度下限</strong><p>始终过滤低于该值的结果；0% 会过滤负相关向量。</p></div><div class="settings-field__slider settings-field__slider--percent"><el-slider v-model="vectorSimilarityPercent" :min="0" :max="100" :step="0.1" :format-tooltip="formatSliderPercent" /><strong>{{ formatSliderPercent(vectorSimilarityPercent) }}</strong></div></div>
              <div class="settings-field settings-field--slider"><div class="settings-field__label"><strong>最终结果数量上限</strong><p>RRF 融合去重后交给上层使用的最大结果数。</p></div><el-form-item prop="resultLimit" class="settings-field__slider"><el-slider v-model="settings.resultLimit" :min="1" :max="Math.min(50, settings.candidateLimit)" :step="1" show-input /></el-form-item></div>
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
            <div v-if="searchResponse" class="search-summary"><span>BM25 候选 <strong>{{ searchResponse.bm25CandidateCount }}</strong></span><span>向量候选 <strong>{{ searchResponse.vectorCandidateCount }}</strong></span><span>融合结果 <strong>{{ searchResponse.results.length }}</strong></span><span>相似度下限 <strong>{{ formatSimilarityPercent(searchResponse.vectorMinSimilarity, 0) }}</strong></span></div>
            <div v-if="searchResponse?.results.length" class="search-results">
              <article v-for="item in searchResponse.results" :key="`${item.documentId}-${item.chunkSequence}`" tabindex="0" @click="showSearchResultDetail(item)" @keyup.enter="showSearchResultDetail(item)"><span class="search-results__rank">{{ item.rank }}</span><div class="search-results__body"><header><div><strong>{{ item.originalName }}</strong><small>文档 #{{ item.documentId }} · Chunk {{ item.chunkSequence }}</small></div><span class="search-results__score">{{ item.vectorScore === null ? '仅关键词命中' : formatCosineScorePercent(item.vectorScore) }}</span></header><p class="search-results__preview">{{ item.content }}</p><footer><el-tag size="small">RRF {{ item.rrfScore.toFixed(4) }}</el-tag><el-tag v-if="item.bm25Rank" size="small" type="warning">BM25 #{{ item.bm25Rank }}</el-tag><el-tag v-if="item.vectorRank" size="small" type="success">向量 #{{ item.vectorRank }}</el-tag><span>点击查看完整内容</span></footer></div></article>
            </div>
            <el-empty v-else-if="searchResponse" description="没有召回结果，请尝试降低阈值或更换问题" />
          </div>
        </el-tab-pane>

        <el-tab-pane name="evaluation" lazy><template #label><el-icon><DataAnalysis /></el-icon>检索评测</template><RagEvaluationPanel :knowledge-base-id="knowledgeBaseId" /></el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog v-model="uploadDialogVisible" title="批量上传知识文档" width="620px" :close-on-click-modal="!batchUploading" :close-on-press-escape="!batchUploading" :show-close="!batchUploading">
      <el-upload v-model:file-list="uploadFiles" class="batch-upload" action="#" drag multiple :auto-upload="false" accept=".txt,.md,.pdf,.docx" :limit="20" :disabled="batchUploading" :on-change="validateUploadFile" :on-exceed="handleUploadExceed">
        <el-icon class="batch-upload__icon"><UploadFilled /></el-icon>
        <div class="batch-upload__text"><strong>把文档拖到这里</strong><span>或者点击选择多个文件</span></div>
        <template #tip><div class="batch-upload__tip">支持 TXT、Markdown、PDF、Word；单文件不超过 20 MB，单次最多 20 个。</div></template>
      </el-upload>
      <template #footer><el-button :disabled="batchUploading" @click="uploadDialogVisible = false">取消</el-button><el-button type="primary" :loading="batchUploading" :disabled="uploadFiles.length === 0" @click="uploadSelectedFiles">上传 {{ uploadFiles.length }} 个文档</el-button></template>
    </el-dialog>

    <el-drawer v-model="previewVisible" title="文档分块预览" size="620px">
      <div v-if="preview" class="preview-drawer"><div class="preview-stats"><span><strong>{{ preview.extractedCharacters }}</strong>正文字符</span><span><strong>{{ preview.totalChunks }}</strong>个分块</span><span><strong>{{ preview.chunkSize }}</strong>最大字符</span><span><strong>{{ preview.chunkOverlap }}</strong>重叠字符</span></div><article v-for="chunk in preview.chunks" :key="chunk.sequence"><header><strong>Chunk {{ chunk.sequence }}</strong><small>{{ chunk.startOffset }}–{{ chunk.endOffset }} · {{ chunk.characterCount }} 字符</small></header><p>{{ chunk.content }}</p></article></div>
    </el-drawer>

    <el-drawer v-model="searchDetailVisible" title="召回 Chunk 详情" size="650px">
      <div v-if="selectedSearchResult" class="search-detail">
        <header><span class="search-results__rank">{{ selectedSearchResult.rank }}</span><div><p class="eyebrow">RETRIEVAL RESULT</p><h3>{{ selectedSearchResult.originalName }}</h3><small>文档 #{{ selectedSearchResult.documentId }} · Chunk {{ selectedSearchResult.chunkSequence }}</small></div></header>
        <div class="search-detail__scores"><span><small>RRF 分数</small><strong>{{ selectedSearchResult.rrfScore.toFixed(4) }}</strong></span><span><small>BM25</small><strong>{{ selectedSearchResult.bm25Rank ? `第 ${selectedSearchResult.bm25Rank} 名` : '未命中' }}</strong><em>{{ selectedSearchResult.bm25Score?.toFixed(3) ?? '—' }}</em></span><span><small>向量召回</small><strong>{{ selectedSearchResult.vectorRank ? `第 ${selectedSearchResult.vectorRank} 名` : '未命中' }}</strong><em>{{ formatCosineScorePercent(selectedSearchResult.vectorScore) }}</em></span></div>
        <section><h4>Chunk 完整内容</h4><p>{{ selectedSearchResult.content }}</p></section>
      </div>
    </el-drawer>
  </div>
</template>

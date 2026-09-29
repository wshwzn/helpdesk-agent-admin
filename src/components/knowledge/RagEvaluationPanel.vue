<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Delete, EditPen, Plus, VideoPlay } from '@element-plus/icons-vue'

import { normalizeApiError } from '@/api/http'
import {
  createRagEvaluationCase,
  deleteRagEvaluationCase,
  getRagEvaluationRun,
  listKnowledgeDocuments,
  listRagEvaluationCases,
  listRagEvaluationRuns,
  runRagEvaluation,
  updateRagEvaluationCase,
} from '@/api/knowledge'
import type {
  KnowledgeDocument,
  RagEvaluationCase,
  RagEvaluationCasePayload,
  RagEvaluationRun,
  RagEvaluationRunSummary,
} from '@/types/knowledge'
import { formatDateTime } from '@/utils/format'

const props = defineProps<{ knowledgeBaseId: number }>()
const loading = ref(true)
const saving = ref(false)
const running = ref(false)
const runLoading = ref(false)
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const cases = ref<RagEvaluationCase[]>([])
const readyDocuments = ref<KnowledgeDocument[]>([])
const runs = ref<RagEvaluationRunSummary[]>([])
const selectedRunId = ref<number | null>(null)
const selectedRun = ref<RagEvaluationRun | null>(null)
const editingCase = ref<RagEvaluationCase | null>(null)
const form = reactive<RagEvaluationCasePayload>({ question: '', expectedDocumentIds: [] })
const rules: FormRules<RagEvaluationCasePayload> = {
  question: [{ required: true, message: '请输入测试问题', trigger: 'blur' }],
  expectedDocumentIds: [{ required: true, type: 'array', min: 1, message: '至少选择一个期望文档', trigger: 'change' }],
}
const canRun = computed(() => cases.value.length > 0 && !running.value)

/** 将 0～1 的评测指标格式化为百分数。 */
function formatMetric(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

/** 分页读取当前知识库的全部 READY 文档，供期望文档多选使用。 */
async function loadReadyDocuments(): Promise<void> {
  const allDocuments: KnowledgeDocument[] = []
  let page = 1
  let pages = 1
  do {
    const result = await listKnowledgeDocuments(props.knowledgeBaseId, page, 100)
    allDocuments.push(...result.records.filter((item) => item.status === 'READY'))
    pages = result.pages
    page += 1
  } while (page <= pages)
  readyDocuments.value = allDocuments
}

/** 读取当前评测集。 */
async function loadCases(): Promise<void> {
  cases.value = await listRagEvaluationCases(props.knowledgeBaseId)
}

/** 读取最近运行记录，并在首次加载时选中最新一次。 */
async function loadRuns(selectLatest = false): Promise<void> {
  runs.value = await listRagEvaluationRuns(props.knowledgeBaseId)
  if (selectLatest && runs.value.length > 0) {
    await selectRun(runs.value[0].id)
  }
}

/** 初始化文档、用例和历史运行。 */
async function initialize(): Promise<void> {
  loading.value = true
  try {
    await Promise.all([loadReadyDocuments(), loadCases(), loadRuns(false)])
    if (runs.value.length > 0) await selectRun(runs.value[0].id)
  } catch (error) {
    ElMessage.error(normalizeApiError(error).message)
  } finally {
    loading.value = false
  }
}

/** 打开空白评测用例表单。 */
function openCreate(): void {
  editingCase.value = null
  form.question = ''
  form.expectedDocumentIds = []
  delete form.version
  dialogVisible.value = true
}

/** 打开已有评测用例并回填问题、文档和版本。 */
function openEdit(item: RagEvaluationCase): void {
  editingCase.value = item
  form.question = item.question
  form.expectedDocumentIds = item.expectedDocuments.map((document) => document.id)
  form.version = item.version
  dialogVisible.value = true
}

/** 校验并创建或更新评测用例。 */
async function saveCase(): Promise<void> {
  if (!(await formRef.value?.validate().catch(() => false))) return
  saving.value = true
  try {
    const payload = {
      question: form.question.trim(),
      expectedDocumentIds: [...new Set(form.expectedDocumentIds)],
      ...(editingCase.value ? { version: form.version } : {}),
    }
    if (editingCase.value) {
      await updateRagEvaluationCase(props.knowledgeBaseId, editingCase.value.id, payload)
    } else {
      await createRagEvaluationCase(props.knowledgeBaseId, payload)
    }
    ElMessage.success(editingCase.value ? '评测用例已更新' : '评测用例已创建')
    dialogVisible.value = false
    await loadCases()
  } catch (error) {
    ElMessage.error(normalizeApiError(error).message)
  } finally {
    saving.value = false
  }
}

/** 二次确认后删除当前用例，历史运行结果不受影响。 */
async function removeCase(item: RagEvaluationCase): Promise<void> {
  try {
    await ElMessageBox.confirm('删除后不会影响历史评测记录，确定继续吗？', '删除评测用例', { type: 'warning' })
    await deleteRagEvaluationCase(props.knowledgeBaseId, item.id)
    ElMessage.success('评测用例已删除')
    await loadCases()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(normalizeApiError(error).message)
  }
}

/** 使用当前检索参数批量运行全部用例，并展示新结果。 */
async function executeEvaluation(): Promise<void> {
  if (!canRun.value) return
  running.value = true
  try {
    selectedRun.value = await runRagEvaluation(props.knowledgeBaseId)
    selectedRunId.value = selectedRun.value.summary.id
    await loadRuns(false)
    ElMessage.success('检索评测已完成')
  } catch (error) {
    ElMessage.error(normalizeApiError(error).message)
  } finally {
    running.value = false
  }
}

/** 切换历史运行并读取当时的逐题召回快照。 */
async function selectRun(runId: number): Promise<void> {
  selectedRunId.value = runId
  runLoading.value = true
  try {
    selectedRun.value = await getRagEvaluationRun(props.knowledgeBaseId, runId)
  } catch (error) {
    ElMessage.error(normalizeApiError(error).message)
  } finally {
    runLoading.value = false
  }
}

onMounted(initialize)
</script>

<template>
  <div v-loading="loading" class="evaluation-panel">
    <header class="evaluation-toolbar">
      <div><p class="eyebrow">RETRIEVAL EVALUATION</p><h3>用固定问题衡量召回效果</h3><p>每个问题可选择多个相关文档，运行后计算文档级 Hit@K、Recall@K 和 MRR。</p></div>
      <div><el-button :icon="Plus" @click="openCreate">新增用例</el-button><el-button type="primary" :icon="VideoPlay" :loading="running" :disabled="!canRun" @click="executeEvaluation">运行全部用例</el-button></div>
    </header>

    <section class="evaluation-section">
      <div class="evaluation-section__heading"><h4>评测集</h4><span>{{ cases.length }} 个问题 · 单次最多 100 个</span></div>
      <el-table :data="cases" class="admin-table">
        <el-table-column prop="question" label="测试问题" min-width="260" />
        <el-table-column label="期望文档" min-width="300"><template #default="{ row }"><div class="evaluation-document-tags"><el-tag v-for="document in row.expectedDocuments" :key="document.id" size="small" effect="plain">{{ document.originalName }}</el-tag></div></template></el-table-column>
        <el-table-column label="操作" width="150" align="right"><template #default="{ row }"><el-button text :icon="EditPen" @click="openEdit(row)">编辑</el-button><el-button text type="danger" :icon="Delete" @click="removeCase(row)">删除</el-button></template></el-table-column>
        <template #empty><el-empty description="还没有评测问题" :image-size="64"><el-button type="primary" :icon="Plus" @click="openCreate">添加第一条用例</el-button></el-empty></template>
      </el-table>
    </section>

    <section class="evaluation-section evaluation-runs">
      <div class="evaluation-section__heading"><h4>运行结果</h4><el-select v-if="runs.length" v-model="selectedRunId" placeholder="选择历史运行" style="width: 250px" @change="selectRun"><el-option v-for="run in runs" :key="run.id" :label="`${formatDateTime(run.createdAt)} · Hit ${formatMetric(run.hitRate)}`" :value="run.id" /></el-select></div>
      <div v-if="selectedRun" v-loading="runLoading">
        <div class="evaluation-metrics"><article><small>Hit@{{ selectedRun.summary.resultLimit }}</small><strong>{{ formatMetric(selectedRun.summary.hitRate) }}</strong><span>{{ selectedRun.summary.hitCases }}/{{ selectedRun.summary.totalCases }} 个问题命中</span></article><article><small>Recall@{{ selectedRun.summary.resultLimit }}</small><strong>{{ formatMetric(selectedRun.summary.recallAtK) }}</strong><span>期望文档平均覆盖率</span></article><article><small>MRR</small><strong>{{ selectedRun.summary.meanReciprocalRank.toFixed(3) }}</strong><span>首个相关结果排名质量</span></article><article><small>平均耗时</small><strong>{{ selectedRun.summary.averageLatencyMs }} ms</strong><span>每个问题完整检索耗时</span></article></div>
        <p class="evaluation-snapshot">参数快照：单路候选 {{ selectedRun.summary.candidateLimit }} · 相似度下限 {{ formatMetric(selectedRun.summary.vectorMinSimilarity) }} · 最终结果 {{ selectedRun.summary.resultLimit }}</p>
        <div class="evaluation-results">
          <details v-for="result in selectedRun.results" :key="result.caseId" :open="!result.hit" class="evaluation-result" :class="{ 'evaluation-result--failed': !result.hit }">
            <summary><el-tag :type="result.hit ? 'success' : 'danger'" size="small">{{ result.hit ? '命中' : '未命中' }}</el-tag><strong>{{ result.question }}</strong><span>Recall {{ formatMetric(result.recallAtK) }} · {{ result.firstRelevantRank ? `首个相关 #${result.firstRelevantRank}` : '无相关结果' }} · {{ result.latencyMs }} ms</span></summary>
            <div class="evaluation-result__body"><p>期望文档</p><div class="evaluation-document-tags"><el-tag v-for="document in result.expectedDocuments" :key="document.id" size="small" effect="plain">{{ document.originalName }}</el-tag></div><p>实际召回 Chunk</p><article v-for="chunk in result.retrievedResults" :key="`${chunk.documentId}-${chunk.chunkSequence}`"><header><strong>#{{ chunk.rank }} {{ chunk.originalName }}</strong><span>Chunk {{ chunk.chunkSequence }}</span></header><p>{{ chunk.content }}</p></article><el-empty v-if="!result.retrievedResults.length" description="本题没有召回任何 Chunk" :image-size="48" /></div>
          </details>
        </div>
      </div>
      <el-empty v-else description="运行评测后，这里会展示可比较的指标和逐题结果" :image-size="70" />
    </section>

    <el-dialog v-model="dialogVisible" :title="editingCase ? '编辑评测用例' : '新增评测用例'" width="560px">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="测试问题" prop="question"><el-input v-model="form.question" type="textarea" :rows="3" maxlength="2000" show-word-limit placeholder="输入一个真实客户可能提出的问题" /></el-form-item>
        <el-form-item label="期望命中的文档" prop="expectedDocumentIds"><el-select v-model="form.expectedDocumentIds" multiple filterable collapse-tags :max-collapse-tags="3" placeholder="可选择多个已完成索引的文档" style="width: 100%"><el-option v-for="document in readyDocuments" :key="document.id" :label="document.originalName" :value="document.id" /></el-select><small class="form-tip">只显示 READY 文档；命中其中任意一个会计入 Hit@K，Recall@K 反映整体覆盖率。</small></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" :loading="saving" @click="saveCase">保存</el-button></template>
    </el-dialog>
  </div>
</template>

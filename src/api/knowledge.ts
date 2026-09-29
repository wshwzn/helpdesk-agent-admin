import { requestBlob, requestData, requestVoid } from '@/api/http'
import type { PageResponse } from '@/types/api'
import type {
  DocumentChunkPreview,
  KnowledgeBase,
  KnowledgeDocument,
  KnowledgeSearchResponse,
  RagEvaluationCase,
  RagEvaluationCasePayload,
  RagEvaluationRun,
  RagEvaluationRunSummary,
  RetrievalSettingsPayload,
} from '@/types/knowledge'

/** 查询全部知识库。 */
export function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  return requestData({ method: 'GET', url: '/admin/knowledge-bases' })
}

/** 查询指定知识库详情。 */
export function getKnowledgeBase(id: number): Promise<KnowledgeBase> {
  return requestData({ method: 'GET', url: `/admin/knowledge-bases/${id}` })
}

/** 创建知识库。 */
export function createKnowledgeBase(payload: { name: string; description: string | null }): Promise<KnowledgeBase> {
  return requestData({ method: 'POST', url: '/admin/knowledge-bases', data: payload })
}

/** 删除不包含文档的知识库。 */
export function deleteKnowledgeBase(id: number): Promise<void> {
  return requestVoid({ method: 'DELETE', url: `/admin/knowledge-bases/${id}` })
}

/** 将知识库设为客户对话 RAG 使用的唯一默认项。 */
export function setDefaultKnowledgeBase(id: number): Promise<KnowledgeBase> {
  return requestData({ method: 'POST', url: `/admin/knowledge-bases/${id}/default` })
}

/** 更新知识库的混合检索参数。 */
export function updateRetrievalSettings(id: number, payload: RetrievalSettingsPayload): Promise<RetrievalSettingsPayload> {
  return requestData({ method: 'PUT', url: `/admin/knowledge-bases/${id}/retrieval-settings`, data: payload })
}

/** 分页查询知识库文档。 */
export function listKnowledgeDocuments(id: number, page = 1, size = 20): Promise<PageResponse<KnowledgeDocument>> {
  return requestData({ method: 'GET', url: `/admin/knowledge-bases/${id}/documents`, params: { page, size } })
}

/** 查询一个知识库文档的元数据。 */
export function getKnowledgeDocument(knowledgeBaseId: number, documentId: number): Promise<KnowledgeDocument> {
  return requestData({ method: 'GET', url: `/admin/knowledge-bases/${knowledgeBaseId}/documents/${documentId}` })
}

/** 读取一个知识库文档的原始二进制内容。 */
export function getKnowledgeDocumentContent(knowledgeBaseId: number, documentId: number): Promise<Blob> {
  return requestBlob({ method: 'GET', url: `/admin/knowledge-bases/${knowledgeBaseId}/documents/${documentId}/content` })
}

/** 上传一个原始文档。 */
export function uploadKnowledgeDocument(id: number, file: File): Promise<KnowledgeDocument> {
  const data = new FormData()
  data.append('file', file)
  return requestData({ method: 'POST', url: `/admin/knowledge-bases/${id}/documents`, data })
}

/** 触发文档异步索引。 */
export function indexKnowledgeDocument(knowledgeBaseId: number, documentId: number): Promise<KnowledgeDocument> {
  return requestData({ method: 'POST', url: `/admin/knowledge-bases/${knowledgeBaseId}/documents/${documentId}/index` })
}

/** 删除文档对象和元数据。 */
export function deleteKnowledgeDocument(knowledgeBaseId: number, documentId: number): Promise<void> {
  return requestVoid({ method: 'DELETE', url: `/admin/knowledge-bases/${knowledgeBaseId}/documents/${documentId}` })
}

/** 解析文档并预览第一页分块。 */
export function previewDocumentChunks(knowledgeBaseId: number, documentId: number): Promise<DocumentChunkPreview> {
  return requestData({ method: 'POST', url: `/admin/knowledge-bases/${knowledgeBaseId}/documents/${documentId}/chunk-preview`, params: { page: 1, size: 20 } })
}

/** 使用当前参数调试知识库混合检索。 */
export function searchKnowledgeBase(id: number, query: string): Promise<KnowledgeSearchResponse> {
  return requestData({ method: 'POST', url: `/admin/knowledge-bases/${id}/search`, data: { query } })
}

/** 查询知识库当前维护的全部 RAG 评测用例。 */
export function listRagEvaluationCases(id: number): Promise<RagEvaluationCase[]> {
  return requestData({ method: 'GET', url: `/admin/knowledge-bases/${id}/evaluation/cases` })
}

/** 创建一条支持多个期望文档的 RAG 评测用例。 */
export function createRagEvaluationCase(id: number, payload: RagEvaluationCasePayload): Promise<RagEvaluationCase> {
  return requestData({ method: 'POST', url: `/admin/knowledge-bases/${id}/evaluation/cases`, data: payload })
}

/** 修改 RAG 评测问题及其期望文档列表。 */
export function updateRagEvaluationCase(id: number, caseId: number, payload: RagEvaluationCasePayload): Promise<RagEvaluationCase> {
  return requestData({ method: 'PUT', url: `/admin/knowledge-bases/${id}/evaluation/cases/${caseId}`, data: payload })
}

/** 删除当前评测用例，历史运行快照继续保留。 */
export function deleteRagEvaluationCase(id: number, caseId: number): Promise<void> {
  return requestVoid({ method: 'DELETE', url: `/admin/knowledge-bases/${id}/evaluation/cases/${caseId}` })
}

/** 使用当前检索参数运行全部评测用例，批量模型调用允许最长五分钟。 */
export function runRagEvaluation(id: number): Promise<RagEvaluationRun> {
  return requestData({ method: 'POST', url: `/admin/knowledge-bases/${id}/evaluation/runs`, timeout: 300_000 })
}

/** 查询最近十次 RAG 评测运行汇总。 */
export function listRagEvaluationRuns(id: number): Promise<RagEvaluationRunSummary[]> {
  return requestData({ method: 'GET', url: `/admin/knowledge-bases/${id}/evaluation/runs`, params: { limit: 10 } })
}

/** 查询一次 RAG 评测的逐题召回快照。 */
export function getRagEvaluationRun(id: number, runId: number): Promise<RagEvaluationRun> {
  return requestData({ method: 'GET', url: `/admin/knowledge-bases/${id}/evaluation/runs/${runId}` })
}

/** 删除一次 RAG 评测运行的汇总和逐题快照。 */
export function deleteRagEvaluationRun(id: number, runId: number): Promise<void> {
  return requestVoid({ method: 'DELETE', url: `/admin/knowledge-bases/${id}/evaluation/runs/${runId}` })
}

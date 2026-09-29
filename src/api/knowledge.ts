import { requestData, requestVoid } from '@/api/http'
import type { PageResponse } from '@/types/api'
import type {
  DocumentChunkPreview,
  KnowledgeBase,
  KnowledgeDocument,
  KnowledgeSearchResponse,
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

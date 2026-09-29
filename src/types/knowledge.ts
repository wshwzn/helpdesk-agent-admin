export interface KnowledgeBase {
  id: number
  name: string
  description: string | null
  retrievalCandidateLimit: number
  vectorMinSimilarity: number
  retrievalResultLimit: number
  isDefault: boolean
  documentCount: number
  version: number
  createdAt: string
  updatedAt: string
}

export type KnowledgeDocumentStatus = 'UPLOADING' | 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'

export interface KnowledgeDocument {
  id: number
  knowledgeBaseId: number
  originalName: string
  contentType: string
  fileExtension: string
  sizeBytes: number
  sha256: string
  status: KnowledgeDocumentStatus
  chunkCount: number
  errorCode: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface DocumentChunk {
  sequence: number
  startOffset: number
  endOffset: number
  characterCount: number
  content: string
}

export interface DocumentChunkPreview {
  documentId: number
  originalName: string
  detectedContentType: string
  extractedCharacters: number
  chunkSize: number
  chunkOverlap: number
  totalChunks: number
  page: number
  size: number
  pages: number
  chunks: DocumentChunk[]
}

export interface RetrievalSettingsPayload {
  candidateLimit: number
  vectorMinSimilarity: number
  resultLimit: number
}

export interface KnowledgeSearchResult {
  rank: number
  documentId: number
  chunkSequence: number
  originalName: string
  content: string
  rrfScore: number
  bm25Rank: number | null
  bm25Score: number | null
  vectorRank: number | null
  vectorScore: number | null
}

export interface KnowledgeSearchResponse extends RetrievalSettingsPayload {
  knowledgeBaseId: number
  query: string
  bm25CandidateCount: number
  vectorCandidateCount: number
  results: KnowledgeSearchResult[]
}

export interface RagExpectedDocument {
  id: number
  originalName: string
}

export interface RagEvaluationCase {
  id: number
  knowledgeBaseId: number
  question: string
  expectedDocuments: RagExpectedDocument[]
  version: number
  createdAt: string
  updatedAt: string
}

export interface RagEvaluationCasePayload {
  question: string
  expectedDocumentIds: number[]
  version?: number
}

export interface RagEvaluationRunSummary extends RetrievalSettingsPayload {
  id: number
  knowledgeBaseId: number
  totalCases: number
  hitCases: number
  hitRate: number
  recallAtK: number
  meanReciprocalRank: number
  averageLatencyMs: number
  createdAt: string
}

export interface RagEvaluationCaseResult {
  caseId: number
  question: string
  expectedDocuments: RagExpectedDocument[]
  hit: boolean
  expectedDocumentCount: number
  matchedDocumentCount: number
  firstRelevantRank: number | null
  recallAtK: number
  reciprocalRank: number
  latencyMs: number
  retrievedResults: KnowledgeSearchResult[]
}

export interface RagEvaluationRun {
  summary: RagEvaluationRunSummary
  results: RagEvaluationCaseResult[]
}

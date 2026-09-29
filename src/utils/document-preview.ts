export type DocumentPreviewKind = 'pdf' | 'text' | 'docx' | 'unsupported'

/** 根据文档扩展名选择安全、稳定的浏览器预览方式。 */
export function resolveDocumentPreviewKind(extension: string): DocumentPreviewKind {
  const normalized = extension.trim().toLowerCase().replace(/^\./, '')
  if (normalized === 'pdf') return 'pdf'
  if (normalized === 'txt' || normalized === 'md') return 'text'
  if (normalized === 'docx') return 'docx'
  return 'unsupported'
}

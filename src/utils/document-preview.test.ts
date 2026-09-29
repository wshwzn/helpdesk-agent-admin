import { describe, expect, it } from 'vitest'

import { resolveDocumentPreviewKind } from '@/utils/document-preview'

describe('原始文档预览类型判断', () => {
  it('识别当前允许上传的四种文档格式', () => {
    expect(resolveDocumentPreviewKind('pdf')).toBe('pdf')
    expect(resolveDocumentPreviewKind('.TXT')).toBe('text')
    expect(resolveDocumentPreviewKind('md')).toBe('text')
    expect(resolveDocumentPreviewKind('docx')).toBe('docx')
  })

  it('对未知扩展名返回不支持', () => {
    expect(resolveDocumentPreviewKind('xlsx')).toBe('unsupported')
  })
})

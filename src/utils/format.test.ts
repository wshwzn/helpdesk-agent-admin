import { describe, expect, it } from 'vitest'

import { formatBytes, formatCosineScorePercent, formatDateTime, formatSimilarityPercent } from './format'

describe('管理端格式化工具', () => {
  it('按文件大小选择合适单位', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB')
  })

  it('空时间显示占位符', () => {
    expect(formatDateTime(null)).toBe('—')
  })

  it('将相似度转换为百分数', () => {
    expect(formatSimilarityPercent(0.6532)).toBe('65.3%')
    expect(formatSimilarityPercent(null)).toBe('关闭')
    expect(formatCosineScorePercent(0.91)).toBe('82.0%')
    expect(formatCosineScorePercent(null)).toBe('未命中')
  })
})

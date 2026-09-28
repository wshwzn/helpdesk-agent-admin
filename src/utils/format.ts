/** 将后端时间转换为中文日期时间。 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

/** 将字节数转换为易读的文件大小。 */
export function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 ** 2).toFixed(1)} MB`
}

/** 将 0～1 的相似度转换为百分数展示。 */
export function formatSimilarityPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '关闭'
  return `${(value * 100).toFixed(digits)}%`
}

/** 将 Elasticsearch 的余弦向量分数还原为相似度百分数。 */
export function formatCosineScorePercent(score: number | null | undefined, digits = 1): string {
  if (score === null || score === undefined) return '未命中'
  const similarity = Math.max(-1, Math.min(1, score * 2 - 1))
  return formatSimilarityPercent(similarity, digits)
}

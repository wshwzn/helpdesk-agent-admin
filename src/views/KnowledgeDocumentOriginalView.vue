<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Back, Download } from '@element-plus/icons-vue'
import { renderAsync } from 'docx-preview'

import { normalizeApiError } from '@/api/http'
import { getKnowledgeDocument, getKnowledgeDocumentContent } from '@/api/knowledge'
import type { KnowledgeDocument } from '@/types/knowledge'
import { resolveDocumentPreviewKind } from '@/utils/document-preview'
import { formatBytes } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const knowledgeBaseId = Number(route.params.id)
const documentId = Number(route.params.documentId)
const loading = ref(true)
const errorMessage = ref('')
const document = ref<KnowledgeDocument | null>(null)
const originalBlob = ref<Blob | null>(null)
const objectUrl = ref('')
const textContent = ref('')
const docxContainer = ref<HTMLElement | null>(null)
const previewKind = computed(() => resolveDocumentPreviewKind(document.value?.fileExtension ?? ''))

/** 加载文档元数据和原始文件，并按格式准备浏览器预览。 */
async function initialize(): Promise<void> {
  if (!Number.isInteger(knowledgeBaseId) || knowledgeBaseId < 1 || !Number.isInteger(documentId) || documentId < 1) {
    await router.replace('/knowledge')
    return
  }
  loading.value = true
  errorMessage.value = ''
  try {
    const [metadata, blob] = await Promise.all([
      getKnowledgeDocument(knowledgeBaseId, documentId),
      getKnowledgeDocumentContent(knowledgeBaseId, documentId),
    ])
    document.value = metadata
    originalBlob.value = blob
    objectUrl.value = URL.createObjectURL(blob)
    if (resolveDocumentPreviewKind(metadata.fileExtension) === 'text') {
      textContent.value = await blob.text()
    }
    await nextTick()
    if (resolveDocumentPreviewKind(metadata.fileExtension) === 'docx') await renderDocx(blob)
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    loading.value = false
  }
}

/** 将 DOCX 二进制内容渲染到独立容器中。 */
async function renderDocx(blob: Blob): Promise<void> {
  if (!docxContainer.value) return
  await renderAsync(await blob.arrayBuffer(), docxContainer.value, undefined, {
    className: 'document-original-docx',
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
  })
}

/** 使用原始文件名下载当前已加载的文档。 */
function downloadOriginal(): void {
  if (!document.value || !objectUrl.value) return
  const link = window.document.createElement('a')
  link.href = objectUrl.value
  link.download = document.value.originalName
  link.click()
}

/** 返回知识库详情页，兼容预览页被直接打开的情况。 */
async function returnToDetail(): Promise<void> {
  await router.push({ name: 'knowledge-detail', params: { id: knowledgeBaseId } })
}

/** 页面卸载时释放浏览器创建的临时文件地址。 */
function releaseObjectUrl(): void {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
}

onMounted(initialize)
onBeforeUnmount(releaseObjectUrl)
</script>

<template>
  <main v-loading="loading" class="document-original-page">
    <header class="document-original-header">
      <div class="document-original-title">
        <el-button circle :icon="Back" aria-label="返回知识库" @click="returnToDetail" />
        <div>
          <p class="eyebrow">ORIGINAL DOCUMENT</p>
          <h1>{{ document?.originalName || '原始文档' }}</h1>
          <span v-if="document">{{ document.fileExtension.toUpperCase() }} · {{ formatBytes(document.sizeBytes) }}</span>
        </div>
      </div>
      <el-button v-if="document && objectUrl" type="primary" :icon="Download" @click="downloadOriginal">下载原文件</el-button>
    </header>

    <section class="document-original-canvas">
      <el-result v-if="errorMessage" icon="error" title="原文加载失败" :sub-title="errorMessage">
        <template #extra><el-button type="primary" @click="initialize">重新加载</el-button></template>
      </el-result>
      <iframe v-else-if="previewKind === 'pdf' && objectUrl" :src="objectUrl" :title="document?.originalName" />
      <pre v-else-if="previewKind === 'text'">{{ textContent }}</pre>
      <div v-else-if="previewKind === 'docx'" ref="docxContainer" class="document-original-docx-host" />
      <el-empty v-else-if="!loading" description="该文件格式暂不支持在线预览，请下载后查看">
        <el-button type="primary" :icon="Download" @click="downloadOriginal">下载原文件</el-button>
      </el-empty>
    </section>
  </main>
</template>

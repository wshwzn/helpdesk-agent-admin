<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Box, ChatDotRound, Connection, Document, Reading } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import { normalizeApiError } from '@/api/http'
import { listKnowledgeBases } from '@/api/knowledge'
import { listModelConfigs } from '@/api/model-config'
import type { KnowledgeBase } from '@/types/knowledge'
import type { ModelConfig } from '@/types/model'

const router = useRouter()
const loading = ref(true)
const models = ref<ModelConfig[]>([])
const knowledgeBases = ref<KnowledgeBase[]>([])
const enabledModels = computed(() => models.value.filter((item) => item.enabled).length)
const documentCount = computed(() => knowledgeBases.value.reduce((sum, item) => sum + item.documentCount, 0))
const readyState = computed(() => models.value.some((item) => item.modelType === 'CHAT' && item.isDefault)
  && models.value.some((item) => item.modelType === 'EMBEDDING' && item.isDefault))

/** 汇总模型和知识库数据生成控制台概览。 */
async function loadDashboard(): Promise<void> {
  loading.value = true
  try {
    ;[models.value, knowledgeBases.value] = await Promise.all([listModelConfigs(), listKnowledgeBases()])
  } catch (error) {
    ElMessage.error(normalizeApiError(error).message)
  } finally {
    loading.value = false
  }
}

onMounted(loadDashboard)
</script>

<template>
  <div v-loading="loading" class="page-stack">
    <section class="welcome-panel">
      <div>
        <p class="eyebrow eyebrow--light">OVERVIEW</p>
        <h2>智能服务，从可靠配置开始。</h2>
        <p>模型负责思考，知识库提供依据。这里汇总当前系统最重要的运行准备状态。</p>
      </div>
      <div class="welcome-panel__orb"><ChatDotRound /></div>
    </section>

    <section class="metric-grid">
      <article class="metric-card"><span class="metric-card__icon metric-card__icon--violet"><Box /></span><div><small>模型配置</small><strong>{{ models.length }}</strong><p>{{ enabledModels }} 个已启用</p></div></article>
      <article class="metric-card"><span class="metric-card__icon metric-card__icon--blue"><Reading /></span><div><small>知识库</small><strong>{{ knowledgeBases.length }}</strong><p>独立检索空间</p></div></article>
      <article class="metric-card"><span class="metric-card__icon metric-card__icon--amber"><Document /></span><div><small>已上传文档</small><strong>{{ documentCount }}</strong><p>等待知识被调用</p></div></article>
      <article class="metric-card"><span class="metric-card__icon metric-card__icon--green"><Connection /></span><div><small>RAG 准备状态</small><strong class="metric-card__word">{{ readyState ? '就绪' : '待配置' }}</strong><p>默认 Chat + Embedding</p></div></article>
    </section>

    <section class="dashboard-columns">
      <article class="surface-card">
        <header class="surface-card__header"><div><p class="eyebrow">QUICK START</p><h3>下一步建议</h3></div></header>
        <div class="action-list">
          <button @click="router.push('/models')"><span>1</span><div><strong>确认默认模型</strong><small>分别准备 Chat 与 Embedding 模型</small></div><el-icon><ArrowRight /></el-icon></button>
          <button @click="router.push('/knowledge')"><span>2</span><div><strong>维护知识文档</strong><small>上传、预览并完成向量索引</small></div><el-icon><ArrowRight /></el-icon></button>
          <button @click="router.push('/knowledge')"><span>3</span><div><strong>验证召回质量</strong><small>调整阈值并查看双路检索排名</small></div><el-icon><ArrowRight /></el-icon></button>
        </div>
      </article>
      <article class="surface-card">
        <header class="surface-card__header"><div><p class="eyebrow">KNOWLEDGE</p><h3>知识库概览</h3></div><el-button text type="primary" @click="router.push('/knowledge')">查看全部</el-button></header>
        <div v-if="knowledgeBases.length" class="compact-list">
          <div v-for="item in knowledgeBases.slice(0, 4)" :key="item.id"><span class="compact-list__avatar">{{ item.name.slice(0, 1) }}</span><div><strong>{{ item.name }}</strong><small>{{ item.documentCount }} 个文档 · 返回 {{ item.retrievalResultLimit }} 条结果</small></div></div>
        </div>
        <el-empty v-else description="还没有知识库" :image-size="70" />
      </article>
    </section>
  </div>
</template>

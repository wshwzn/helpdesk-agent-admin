<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { ArrowRight, Delete, Document, Plus, Search, StarFilled } from '@element-plus/icons-vue'

import { normalizeApiError } from '@/api/http'
import { createKnowledgeBase, deleteKnowledgeBase, listKnowledgeBases, setDefaultKnowledgeBase } from '@/api/knowledge'
import type { KnowledgeBase } from '@/types/knowledge'
import { formatDateTime } from '@/utils/format'

interface KnowledgeForm { name: string; description: string }

const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const knowledgeBases = ref<KnowledgeBase[]>([])
const form = reactive<KnowledgeForm>({ name: '', description: '' })
const rules: FormRules<KnowledgeForm> = {
  name: [{ required: true, message: '请输入知识库名称', trigger: 'blur' }],
}

/** 查询知识库及其文档数量。 */
async function loadKnowledgeBases(): Promise<void> {
  loading.value = true
  try {
    knowledgeBases.value = await listKnowledgeBases()
  } catch (error) {
    ElMessage.error(normalizeApiError(error).message)
  } finally {
    loading.value = false
  }
}

/** 清空表单并打开新建知识库对话框。 */
function openCreate(): void {
  form.name = ''
  form.description = ''
  dialogVisible.value = true
}

/** 校验并创建知识库。 */
async function saveKnowledgeBase(): Promise<void> {
  if (!(await formRef.value?.validate().catch(() => false))) return
  saving.value = true
  try {
    const created = await createKnowledgeBase({ name: form.name.trim(), description: form.description.trim() || null })
    ElMessage.success('知识库已创建')
    dialogVisible.value = false
    await router.push(`/knowledge/${created.id}`)
  } catch (error) {
    ElMessage.error(normalizeApiError(error).message)
  } finally {
    saving.value = false
  }
}

/** 删除没有文档的知识库并刷新列表。 */
async function removeKnowledgeBase(item: KnowledgeBase): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除“${item.name}”吗？`, '删除知识库', { type: 'warning' })
    await deleteKnowledgeBase(item.id)
    ElMessage.success('知识库已删除')
    await loadKnowledgeBases()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(normalizeApiError(error).message)
  }
}

/** 将选中的知识库设为客户对话使用的默认知识库。 */
async function makeDefault(item: KnowledgeBase): Promise<void> {
  try {
    await setDefaultKnowledgeBase(item.id)
    ElMessage.success(`“${item.name}”已设为默认知识库`)
    await loadKnowledgeBases()
  } catch (error) {
    ElMessage.error(normalizeApiError(error).message)
  }
}

onMounted(loadKnowledgeBases)
</script>

<template>
  <div class="page-stack">
    <section class="page-heading">
      <div><p class="eyebrow">KNOWLEDGE SPACES</p><h2>知识库</h2><p>管理原始文档、向量索引和混合检索策略。</p></div>
      <el-button type="primary" :icon="Plus" @click="openCreate">新建知识库</el-button>
    </section>

    <section v-loading="loading" class="knowledge-grid">
      <article v-for="item in knowledgeBases" :key="item.id" class="knowledge-card" @click="router.push(`/knowledge/${item.id}`)">
        <header><div class="knowledge-card__identity"><span class="knowledge-card__icon">{{ item.name.slice(0, 1) }}</span><el-tag v-if="item.isDefault" type="success" effect="light" round><el-icon><StarFilled /></el-icon>默认</el-tag></div><el-dropdown trigger="click" @click.stop><button class="more-button">•••</button><template #dropdown><el-dropdown-menu><el-dropdown-item v-if="!item.isDefault" :icon="StarFilled" @click="makeDefault(item)">设为默认</el-dropdown-item><el-dropdown-item :icon="Delete" :disabled="item.documentCount > 0" @click="removeKnowledgeBase(item)">删除知识库</el-dropdown-item></el-dropdown-menu></template></el-dropdown></header>
        <h3>{{ item.name }}</h3>
        <p>{{ item.description || '暂未填写知识库说明。' }}</p>
        <div class="knowledge-card__stats">
          <span><el-icon><Document /></el-icon><strong>{{ item.documentCount }}</strong> 文档</span>
          <span><el-icon><Search /></el-icon>返回 <strong>{{ item.retrievalResultLimit }}</strong> 条</span>
        </div>
        <footer><small>更新于 {{ formatDateTime(item.updatedAt) }}</small><el-icon><ArrowRight /></el-icon></footer>
      </article>
      <button v-if="!loading" class="knowledge-card knowledge-card--create" @click="openCreate"><span><el-icon><Plus /></el-icon></span><strong>创建新知识库</strong><small>为一类独立知识建立检索空间</small></button>
    </section>

    <el-dialog v-model="dialogVisible" title="新建知识库" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="知识库名称" prop="name"><el-input v-model="form.name" maxlength="100" show-word-limit placeholder="例如：产品帮助中心" /></el-form-item>
        <el-form-item label="用途说明"><el-input v-model="form.description" type="textarea" :rows="4" maxlength="500" show-word-limit placeholder="说明该知识库包含什么内容" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" :loading="saving" @click="saveKnowledgeBase">创建并进入</el-button></template>
    </el-dialog>
  </div>
</template>

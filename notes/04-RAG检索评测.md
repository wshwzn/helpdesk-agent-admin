# RAG 检索评测

## 实现功能

- 知识库详情新增“检索评测”页签。
- 管理员可以新增、编辑和删除测试问题，并从 READY 文档中多选期望来源。
- 支持一键运行全部用例，展示 Hit@K、Recall@K、MRR、平均耗时和检索参数快照。
- 支持切换最近十次历史运行，逐题查看期望文档和实际召回 Chunk；未命中的问题默认展开。
- 支持在历史结果旁删除当前选中的运行记录；二次确认后移除该次指标与逐题快照，并自动展示相邻记录。

## 新增文件

- `src/components/knowledge/RagEvaluationPanel.vue`：维护评测集、运行评测并展示历史结果。

## 修改文件

- `src/types/knowledge.ts`：增加评测用例、运行汇总和逐题结果类型。
- `src/api/knowledge.ts`：增加评测用例、运行查询和运行删除接口，批量运行超时设置为五分钟。
- `src/views/KnowledgeBaseDetailView.vue`：接入检索评测页签。
- `src/styles/index.css`：增加评测工具栏、指标卡、历史结果和 Chunk 列表样式。

## API 影响

依赖后端 `/api/admin/knowledge-bases/{id}/evaluation` 接口，不使用本地持久化。删除运行调用 `DELETE /api/admin/knowledge-bases/{id}/evaluation/runs/{runId}`，不会删除测试用例。

## 验证

- `npm run test`：5 项测试通过。
- `npm run build`：生产构建成功。

## 已知限制

- 当前仅选择 READY 文档作为期望来源。
- 当前运行最多同步处理 100 个问题，不提供暂停和后台进度展示。

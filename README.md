# Helpdesk Agent 管理端

`helpdesk-agent-admin` 是智能客服项目的独立管理控制台，用于维护模型配置、知识库文档和 RAG 检索参数。客户端项目为 `helpdesk-agent-web`，后端服务为 `helpdesk-agent`。

## 本地运行

环境要求：Node.js 20+、npm 10+，后端默认运行在 `http://localhost:8080`。

```bash
npm install
npm run dev
```

浏览器访问 `http://127.0.0.1:5174`。开发服务器会把 `/api` 代理至后端，可通过 `.env.local` 覆盖：

```env
VITE_BACKEND_URL=http://localhost:8080
```

## 主要功能

- 管理员 JWT 登录和角色校验
- Chat、Embedding 模型新增、编辑、连接测试、启停和默认项设置
- 知识库创建、默认项设置、文档上传、分块预览、索引和删除
- 单路候选数、向量相似度下限、最终结果数配置
- BM25、KNN 与 RRF 融合结果可视化调试

## 常用命令

```bash
npm run dev        # 启动开发服务器
npm run test       # 运行单元测试
npm run type-check # 执行 TypeScript 类型检查
npm run build      # 类型检查并构建生产产物
```

本地 `.env.local`、JWT、API Key、`node_modules/` 和 `dist/` 不应提交到仓库。

# 知了

面向信息过载场景的个人信息秘书。当前保留原有前端演示，同时提供第一条真实 RSS 垂直链路：接入 Feed、建立基线、后台增量检查、保存证据并在首页展示新内容。

## 本地运行

需要 Node.js 20+、npm 和 Docker。复制环境变量并启动 PostgreSQL：

```bash
cp .env.example .env
docker compose up -d db
set -a && . ./.env && set +a
npm install
npm run db:migrate
```

分别启动 API/Worker 和 Web：

```bash
npm run server:dev
npm run dev
```

也可以用一个命令完成数据库启动、迁移、API、Worker 和 Web 启动：

```bash
npm run dev:setup
```

配置真实分析时，在 `.env` 中取消 `AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL` 注释并填写 OpenAI 兼容服务。未配置时，RSS 仍正常抓取，`/api/ai/status` 返回 `not_configured`，手动分析返回 `AI_NOT_CONFIGURED`。

浏览器打开 `http://127.0.0.1:5173`。服务端默认只监听 `127.0.0.1:8787`，Vite 将 `/api` 代理到服务端。

也可以使用 `npm run dev:all` 同时启动两个进程。

> 当前阶段没有应用级登录。只能在本机使用，或部署在具有可信身份验证的访问层之后；不要直接暴露到公网。

## RSS 行为

- 手动输入 RSS、Atom 或 JSON Feed 地址。
- 默认保存最近 20 条作为基线，首页只显示最新 3 条并标记“首次导入”。
- 可选择“从现在开始”，此时历史内容不进入首页。
- 后续内容按稳定 ID、规范化链接和内容指纹去重。
- ETag 与 Last-Modified 只在成功事务后更新；失败不会被解释为“没有更新”。
- 摘要、历史、抓取状态和技术字段默认折叠。
- 频率、暂停、失败详情和手动重试集中在设置中。
- 抓取使用公网 URL 校验、重定向逐跳检查、超时和 2 MiB 默认大小上限。

PostgreSQL 数据保存在 Docker 卷 `zhiliao-postgres`（Compose 会添加项目名前缀）。备份前先确认实际卷名：

```bash
docker compose volumes
```

## 验证

```bash
npm run lint
npm test
npm run build
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/zhiliao_test npm test -- server/rss/rss-flow.test.ts
```

数据库集成测试使用专用 `zhiliao_test` 数据库和独立 workspace，只删除测试自己创建的数据。

## 前端 Demo

RSS 新内容已接入真实 OpenAI 兼容分析：原文与证据先入库，后台生成简短摘要和相关性。知识库问答、自动研究及其他演示区域仍使用本地数据，不会伪装成已接入模型。

## 可演示路径

- “现在”：查看聚合后的“完成黑客松海报”行动，展开要求并点击证据。
- “完成”：行动、历史和 3 个实际引用来源自动归档，不出现文件选择步骤。
- “保存相关知识”：只把长期有效要求及其引用来源加入知识库。
- “知识库”：按分类浏览聚合后的知识主题；每个主题只有一份摘要，来源位于主题详情中。
- 上传的知识文档会按主题聚合；原始 PDF 只作为主题来源，在详情中按章节和页码回看。
- “问知识库”：按需生成简短回答并附可点击来源，回答不会写回知识库。
- “设置”：集中调整自适应抓取频率与有意义变化提醒。
- “快速接入”：右下角或 `Ctrl/Command + K` 随时接入文字、链接和本地音频；语音按钮为不申请权限的交互模拟。

现有“导入新信息”保留完整来源选择与目标编辑能力，不被快速接入替代。本地音频只通过浏览器对象地址播放，不上传服务器。

后续后端可以分别实现 `AttentionAnalyzer`、知识仓储、来源快照、变化检测和关注调度；当前 Demo 的领域对象已经将来源、事实、版本、行动与知识分离。

行动要求、知识详情、历史版本和助手引用统一使用同一个来源查看器，展示精确位置、高亮原文、完整上下文和原始来源入口。

首页单条证据直接进入来源查看器；多个来源先显示来源列表，再由用户选择具体来源。Demo 中的文档正文是从上传 PDF 提取后选取的演示片段，并非完整 PDF 渲染器。

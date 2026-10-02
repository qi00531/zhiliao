# 知了 RSS AI 分析设计

## 目标

在不重做前端的前提下，为现有 RSS 链路接入真实的 OpenAI 兼容模型服务。RSS 抓取与 AI 分析相互隔离：原始内容和证据先可靠保存，模型在后台生成简短摘要与相关性判断。没有配置模型时，系统必须明确报告不可用，不能返回模拟结果。

## 本次范围

- 使用 OpenAI 兼容的 Chat Completions API。
- 通过服务端环境变量配置模型，不在数据库和浏览器中保存密钥。
- RSS 新内容入库后创建分析任务，由后台 Worker 异步处理。
- 保存简短摘要、相关性、判断理由、分析状态与错误信息。
- 提供模型状态接口，并在健康检查中暴露模型配置状态。
- 提供一个本地开发命令，启动 PostgreSQL、执行迁移并同时运行 API、Worker 与 Web。

本次不实现知识库 RAG、联网研究、用户账号、浏览器端模型设置或前端布局调整。

## 配置

服务端读取以下环境变量：

- `AI_BASE_URL`：OpenAI 兼容服务地址，例如 `https://api.openai.com/v1`。
- `AI_API_KEY`：服务端密钥，只通过请求头发送给模型服务。
- `AI_MODEL`：模型名称。
- `AI_TIMEOUT_MS`：单次模型请求超时，默认 30 秒。

`AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL` 任一缺失时，模型状态为 `not_configured`。日志、API 响应和数据库均不得包含密钥。

## 数据模型

每条 RSS 内容最多对应一个当前分析记录：

- `status`：`pending | processing | completed | failed | not_configured`
- `summary`：最多 120 个中文字符，只压缩原信息，不扩写建议。
- `relevance`：`high | medium | low | unknown`
- `reason`：最多 80 个中文字符，说明与当前目标的关系；没有目标时为 `unknown`。
- `model`：实际使用的模型名。
- `attempt_count`：处理次数。
- `last_error_code`、`last_error_message`：可诊断但不含秘密的失败信息。
- `created_at`、`updated_at`、`completed_at`。

分析任务通过数据库状态领取，避免同一条内容被多个 Worker 重复处理。RSS 条目的原始标题、原始摘要、URL 和证据保持不变；AI 输出只能作为派生字段。

## 数据流

1. RSS 抓取器完成校验、解析与去重。
2. 新条目和证据在一个事务中入库，并创建 `pending` 分析记录。
3. API 立即可读取原始条目，不等待模型。
4. Worker 原子领取一个待处理记录并标记为 `processing`。
5. Worker 将标题、清洗后的原摘要和当前目标发送给模型。
6. 服务端解析并校验模型返回的结构化 JSON。
7. 成功时保存 `summary`、`relevance`、`reason` 并标记 `completed`；失败时记录错误并进行有限重试。

首次接入 RSS 保存的基线条目也进入分析队列，但首页是否展示仍遵循现有的首次导入规则。

## 模型调用

模型适配器只依赖一个窄接口：

```ts
interface ContentAnalyzer {
  analyze(input: {
    title: string
    sourceSummary: string
    goal?: string
  }): Promise<{
    summary: string
    relevance: 'high' | 'medium' | 'low' | 'unknown'
    reason: string
    model: string
  }>
}
```

请求要求模型只返回 JSON。服务端使用 schema 校验字段、枚举和长度；无效输出按可重试失败处理，不能直接写入数据库。

## 失败与重试

- 未配置：记录保持 `not_configured`，API 返回 `AI_NOT_CONFIGURED`，配置补齐后可重新入队。
- 超时、限流和服务端错误：最多重试 3 次，使用递增延迟。
- 身份验证失败：标记失败，不持续重试。
- 输出格式无效：允许有限重试，最终保留 `INVALID_MODEL_OUTPUT`。
- RSS 抓取成功但 AI 失败：原始内容仍然可读，不能回滚或删除。

## API

- `GET /api/ai/status`：返回 `ready | not_configured | unavailable`、模型名和安全的错误代码。
- `POST /api/rss/items/:id/analyze`：手动重新入队；未配置时返回 HTTP 503 与 `AI_NOT_CONFIGURED`。
- `GET /api/rss/items/:id`：在现有内容和证据之外返回 `analysis`；未完成时只返回状态。
- `GET /health`：保留数据库与 Worker 状态，并增加 `ai` 状态；模型未配置不使整个服务健康检查失败。

## 一键本地启动

新增 `npm run dev:setup`：

1. 使用 Docker Compose 启动 PostgreSQL。
2. 等待数据库健康。
3. 执行幂等迁移。
4. 同时启动 API/Worker 与 Vite Web。

应用进程退出时停止 API 和 Web；PostgreSQL 容器继续运行以保留数据。README 与 `.env.example` 提供最短配置示例，并明确未配置模型时的行为。

## 验证

- 配置解析测试覆盖完整配置、缺项和密钥不外泄。
- 模型适配器测试覆盖成功 JSON、超时、401、429 和非法输出。
- 数据库测试覆盖任务创建、原子领取、成功、失败和重新入队。
- RSS 流程测试证明抓取不等待模型，且 AI 失败不影响原文与证据。
- API 测试覆盖模型状态、手动分析和内容详情中的分析状态。
- 启动脚本至少提供可自动验证的前置检查，并在 README 中保留人工验收步骤。

## 成功标准

- 配置有效模型后，新 RSS 条目能在后台得到真实摘要和相关性结果。
- 模型不可用时，RSS 仍能持续抓取并保留证据。
- 未配置模型时，服务端明确返回 `AI_NOT_CONFIGURED`，没有模拟成功。
- 新开发者用一个命令即可启动完整本地运行环境。

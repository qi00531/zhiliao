import type { AttentionSignal, Fact, KnowledgeItem, Source } from '../domain/types'

export const initialGoal = '今天 23:00 前完成一个能参赛的 Demo 和海报'

export const demoSources: Source[] = [
  { id: 'rules', name: '黑客松比赛说明.pdf', kind: 'pdf', detail: '12 页', selected: true, target: { kind: 'pdf', locator: '第 4 页 · 提交材料', excerpt: '展示海报规格：A3（297 × 420 mm），竖版，300 DPI。', preview: 'PDF · 第 4 页' } },
  { id: 'schedule', name: '赛程更新.png', kind: 'image', detail: '1 张截图', selected: true, target: { kind: 'image', locator: '图片右上区域 · 12:51', excerpt: '最终作品提交截止调整为 9 月 12 日 11:30。', preview: '截图 · 已框选识别区域' } },
  { id: 'pilotdeck', name: 'PilotDeck 开发文档', kind: 'url', detail: '网页', selected: true, target: { kind: 'url', locator: 'Quick Start · Fresh Code', excerpt: 'Core implementation submitted for judging must be fresh code.', preview: '网页快照 · pilotdeck.ai/docs' } },
  { id: 'team', name: '队友消息', kind: 'text', detail: '6 条文本', selected: true, target: { kind: 'text', locator: '消息 #4 · 13:06', excerpt: '今晚 23:00 前把 Demo 和海报都收口。', preview: '对话上下文 · 前后各 2 条' } },
]

export const knowledgeSources: Source[] = [
  { id: 'agent-structure-source', name: '深入理解-AI-Agent-李博杰-v1.2.pdf', kind: 'pdf', detail: '308 页', selected: false, target: { kind: 'pdf', locator: '第 1 章 · 第 7 页', excerpt: '现代 Agent = LLM + 上下文 + 工具。', preview: 'PDF · AI Agent 入门' } },
  { id: 'context-source', name: '深入理解-AI-Agent-李博杰-v1.2.pdf', kind: 'pdf', detail: '308 页', selected: false, target: { kind: 'pdf', locator: '第 2 章 · 第 27 页', excerpt: '上下文是决定 Agent 能力上限的关键。', preview: 'PDF · 上下文工程' } },
  { id: 'memory-source', name: '深入理解-AI-Agent-李博杰-v1.2.pdf', kind: 'pdf', detail: '308 页', selected: false, target: { kind: 'pdf', locator: '第 3 章 · 第 69 页', excerpt: '用户记忆、RAG 与结构化知识共同构成 Agent 的知识获取管道。', preview: 'PDF · 用户记忆和知识库' } },
  { id: 'rl-framework-source', name: '论文.pdf', kind: 'pdf', detail: '20 页', selected: false, target: { kind: 'pdf', locator: 'Background · 第 3 页', excerpt: '智能体通过状态、动作与奖励的交互逐步学习策略。', preview: 'PDF · Reinforcement Learning' } },
  { id: 'rl-methods-source', name: '论文.pdf', kind: 'pdf', detail: '20 页', selected: false, target: { kind: 'pdf', locator: 'State-of-the-art · 第 6 页', excerpt: '强化学习方法可从模型、价值与策略等侧重点进行比较。', preview: 'PDF · State-of-the-art' } },
  { id: 'rl-future-source', name: '论文.pdf', kind: 'pdf', detail: '20 页', selected: false, target: { kind: 'pdf', locator: 'Discussion · Future directions', excerpt: '真实环境实验与人工好奇心仍是值得继续研究的方向。', preview: 'PDF · Future directions' } },
]

export const demoFacts: Fact[] = [
  { id: 'poster-format', label: '画布', value: 'A3 · 竖版', sourceIds: ['rules'], revisions: [], reusable: true },
  { id: 'poster-resolution', label: '导出', value: '300 DPI', sourceIds: ['rules'], revisions: [], reusable: true },
  { id: 'poster-finish-deadline', label: '完成时间', value: '今晚 23:00 前', sourceIds: ['team'], revisions: [], reusable: false },
  { id: 'poster-submit-deadline', label: '提交时间', value: '明天 11:30 前', sourceIds: ['rules', 'schedule'], revisions: [{ id: 'deadline-change', previousValue: '明天 12:00 前', currentValue: '明天 11:30 前', observedAt: '今天 12:51', sourceIds: ['schedule'] }], reusable: false },
]

export const initialKnowledge: KnowledgeItem[] = [
  { id: 'attention-routing', title: '目标感知的注意力路由', summary: '有限注意力下，信息价值取决于当前目标、紧迫性、新颖性、行动价值和重复程度。', factIds: [], sourceIds: ['pilotdeck'], categories: ['产品方法', 'AI'], relatedIds: ['change-detection'] },
  { id: 'change-detection', title: '信息变化检测', summary: '对同一事实保留当前值与历史版本，只有语义变化才重新占用注意力。', factIds: [], sourceIds: ['rules', 'schedule'], categories: ['信息管理'], relatedIds: ['attention-routing'] },
  { id: 'agent-structure', title: 'AI Agent 的基本结构', summary: '现代 Agent 由大模型、上下文和工具共同构成，三者分别承担推理、信息供给与外部行动。', factIds: [], sourceIds: ['agent-structure-source'], categories: ['AI Agent'], relatedIds: ['context-engineering', 'user-memory'] },
  { id: 'context-engineering', title: '上下文工程', summary: '上下文工程决定 Agent 在任务中能够看到、保留和调用哪些信息。', factIds: [], sourceIds: ['context-source'], categories: ['AI Agent'], relatedIds: ['agent-structure', 'user-memory'] },
  { id: 'user-memory', title: '用户记忆与知识库', summary: '记忆、检索和结构化组织共同帮助 Agent 获取可追溯、可持续更新的知识。', factIds: [], sourceIds: ['memory-source'], categories: ['AI Agent'], relatedIds: ['context-engineering'] },
  { id: 'rl-framework', title: '强化学习基本框架', summary: '智能体通过环境状态、动作和奖励反馈，在连续交互中学习行为策略。', factIds: [], sourceIds: ['rl-framework-source'], categories: ['强化学习'], relatedIds: ['rl-methods'] },
  { id: 'rl-methods', title: '强化学习方法分类', summary: '常见方法可按模型驱动、价值驱动和策略驱动等侧重点理解与比较。', factIds: [], sourceIds: ['rl-methods-source'], categories: ['强化学习'], relatedIds: ['rl-framework', 'rl-future'] },
  { id: 'rl-future', title: '强化学习研究方向', summary: '真实环境实验、探索效率和人工好奇心仍是强化学习的重要研究问题。', factIds: [], sourceIds: ['rl-future-source'], categories: ['强化学习'], relatedIds: ['rl-methods'] },
]

export const demoSignals: AttentionSignal[] = [
  {
    id: 'team-deadline',
    kind: 'action',
    title: '13:45 前完成组队确认',
    reason: '距离截止只剩 28 分钟，错过后将无法正常参赛。',
    source: '黑客松比赛说明.pdf',
    locator: '第 3 节 · 参赛要求',
    evidence: '所有参赛队伍须于今日 13:45 前在系统中完成组队确认。',
    score: 98,
    disposition: 'unread',
  },
  {
    id: 'poster-change',
    kind: 'changed',
    title: '最终提交时间提前至 11:30',
    reason: '原定 12:00 已发生变化，会直接影响明天的交付安排。',
    source: '赛程更新.png',
    locator: '群公告截图 · 12:51',
    evidence: '时间更新：最终作品提交截止由 9 月 12 日 12:00 调整为 11:30。',
    score: 94,
    disposition: 'unread',
  },
  {
    id: 'public-github',
    kind: 'new',
    title: 'Direction 3 要求 GitHub 仓库公开',
    reason: '影响赛道选择，也意味着提交前需要检查仓库可见性。',
    source: '黑客松比赛说明.pdf',
    locator: '第 5 节 · 赛道规则',
    evidence: '选择 Direction 3 的队伍需提供可公开访问的 GitHub Repository。',
    score: 90,
    disposition: 'unread',
  },
  {
    id: 'poster-spec',
    kind: 'action',
    title: '海报需为 A3 竖版、300 DPI',
    reason: '今晚制作海报时需要按最终规格创建画布。',
    source: '黑客松比赛说明.pdf',
    locator: '第 4 节 · 提交材料',
    evidence: '展示海报规格：A3（297 × 420 mm），竖版，300 DPI。',
    score: 82,
    disposition: 'unread',
  },
  {
    id: 'mentor-time',
    kind: 'new',
    title: '16:00–18:00 可预约 Mentor Time',
    reason: '可以在核心闭环完成后预约一次产品反馈。',
    source: '赛程更新.png',
    locator: '今日赛程',
    evidence: 'Mentor Time 开放时间为今日 16:00–18:00。',
    score: 70,
    disposition: 'unread',
  },
  {
    id: 'no-slides',
    kind: 'known',
    title: '现场 Demo 不要求准备 PPT',
    reason: '已经确认，不再占用当前注意力。',
    source: '队友消息',
    locator: '消息 #4',
    evidence: '工作人员确认：路演直接展示产品，不需要另外准备 PPT。',
    score: 48,
    disposition: 'known',
  },
]

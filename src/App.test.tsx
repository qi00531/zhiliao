import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('Zhilia demo', () => {
  it('opens on a focused three-item briefing', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: '现在值得你注意' })).toBeInTheDocument()
    expect(screen.getAllByTestId('now-signal')).toHaveLength(3)
    expect(screen.getByText('13:45 前完成组队确认')).toBeInTheDocument()
  })

  it('moves an acknowledged signal out of the current briefing', async () => {
    const user = userEvent.setup()
    render(<App />)

    const signal = screen.getByText('13:45 前完成组队确认').closest('article')
    await user.click(screen.getByRole('button', { name: '知道了：13:45 前完成组队确认' }))

    expect(signal).not.toBeInTheDocument()
    expect(screen.getByText('完成黑客松海报')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: '今天你已经知道' })).toHaveTextContent('13:45 前完成组队确认')
    expect(screen.getByLabelText('1 条已知道')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('已加入“今天你已经知道”')
  })

  it('expands known details and reuses the source viewer', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '知道了：13:45 前完成组队确认' }))
    const board = screen.getByRole('complementary', { name: '今天你已经知道' })
    await user.click(within(board).getByRole('button', { name: /13:45 前完成组队确认/ }))

    expect(within(board).getByText('为什么重要')).toBeVisible()
    expect(within(board).getByText(/距离截止只剩 28 分钟/)).toBeVisible()
    expect(within(board).getByText(/所有参赛队伍须于今日 13:45/)).toBeVisible()
    await user.click(within(board).getByRole('button', { name: '查看已知来源：13:45 前完成组队确认' }))
    expect(screen.getByRole('dialog', { name: '来源' })).toBeVisible()
  })

  it('does not add deferred signals to the known board', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '稍后处理：13:45 前完成组队确认' }))

    expect(screen.getByRole('complementary', { name: '今天你已经知道' })).not.toHaveTextContent('13:45 前完成组队确认')
    expect(screen.getByLabelText('0 条已知道')).toBeVisible()
  })

  it('promotes known content only after every current item is handled', async () => {
    const user = userEvent.setup()
    render(<App />)
    const dashboard = screen.getByLabelText('注意力看板')

    await user.click(screen.getByRole('button', { name: '知道了：13:45 前完成组队确认' }))
    await user.click(screen.getByRole('button', { name: '知道了：Direction 3 要求 GitHub 仓库公开' }))
    expect(dashboard).not.toHaveClass('attention-grid--review')

    await user.click(screen.getByRole('button', { name: '标记行动完成' }))
    expect(dashboard).toHaveClass('attention-grid--review')
    expect(screen.getByRole('heading', { name: '审阅你已经确认的内容' })).toBeVisible()
    expect(screen.getByLabelText('2 条已知道')).toBeVisible()
  })

  it('clears known content when the demo is reset', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '知道了：13:45 前完成组队确认' }))
    await user.click(screen.getByRole('button', { name: /重置/ }))

    expect(screen.getByLabelText('0 条已知道')).toBeVisible()
    expect(screen.getByRole('button', { name: '知道了：13:45 前完成组队确认' })).toBeVisible()
  })

  it('reveals source evidence without leaving the briefing', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '查看行动详情' }))
    await user.click(screen.getByRole('button', { name: '查看证据：提交时间' }))

    expect(screen.getByText(/最终作品提交截止调整为/)).toBeVisible()
  })

  it('opens the source drawer and exposes future analysis inputs', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '导入新信息' }))

    const dialog = screen.getByRole('dialog', { name: '信息输入' })
    expect(dialog).toBeVisible()
    expect(screen.getByLabelText('当前目标')).toHaveValue(
      '今天 23:00 前完成一个能参赛的 Demo 和海报',
    )
    expect(within(dialog).getByText('黑客松比赛说明.pdf')).toBeInTheDocument()
  })

  it('groups poster requirements into one actionable briefing', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByText('完成黑客松海报')).toBeInTheDocument()
    expect(screen.queryByText('海报需为 A3 竖版、300 DPI')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '查看行动详情' }))
    expect(screen.getAllByText('A3 · 竖版')).toHaveLength(2)
    expect(screen.getAllByText('300 DPI')).toHaveLength(2)
  })

  it('opens a precise evidence target from an action requirement', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '查看行动详情' }))
    await user.click(screen.getByRole('button', { name: '查看证据：画布' }))

    const evidence = screen.getByRole('dialog', { name: '来源' })
    expect(within(evidence).getByText('第 4 页 · 提交材料')).toBeVisible()
    expect(within(evidence).getByText(/A3（297 × 420 mm）/)).toBeVisible()
  })

  it('archives cited files without asking the user to select them', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '标记行动完成' }))

    expect(screen.queryByText('完成黑客松海报')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('3 个引用来源已随事件归档')
  })

  it('saves reusable poster knowledge and keeps history collapsed', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '查看行动详情' }))
    await user.click(screen.getByRole('button', { name: '保存相关知识' }))
    await user.click(screen.getByRole('button', { name: '知识库' }))
    await user.click(screen.getByText('黑客松展示海报要求'))

    expect(screen.getByRole('button', { name: '历史变化（1）' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('明天 12:00 前')).not.toBeInTheDocument()
  })

  it('keeps watch frequency controls inside settings', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.queryByText('每天检查')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '设置' }))

    expect(screen.getByLabelText('默认检查频率')).toHaveValue('adaptive')
    expect(screen.getByLabelText('海报检查频率')).toHaveValue('adaptive')
    expect(screen.getByText('只有发生有意义变化时提醒')).toBeInTheDocument()
  })

  it('answers on demand with a clickable citation and shows local relations', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '知识库' }))
    await user.click(screen.getByRole('button', { name: '问知识库' }))
    expect(screen.getByText(/使用 A3 竖版画布/)).toBeVisible()
    expect(screen.getByRole('button', { name: /比赛说明 · 第 4 页/ })).toBeVisible()
    await user.click(screen.getByText('信息变化检测'))
    expect(screen.getByText('相关内容')).toBeVisible()
    expect(screen.getByRole('button', { name: '目标感知的注意力路由' })).toBeVisible()
  })

  it('groups knowledge topics under categories instead of listing source files', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '知识库' }))

    expect(screen.getByRole('heading', { name: '产品方法' })).toBeVisible()
    expect(screen.getAllByText('1 个主题')).toHaveLength(2)
    expect(screen.queryByText('PilotDeck 开发文档')).not.toBeInTheDocument()
  })

  it('uses the same source viewer from knowledge citations', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '知识库' }))
    await user.click(screen.getByText('信息变化检测'))
    await user.click(screen.getByRole('button', { name: /赛程更新.png/ }))

    const viewer = screen.getByRole('dialog', { name: '来源' })
    expect(within(viewer).getByText('图片右上区域 · 12:51')).toBeVisible()
    expect(within(viewer).getByRole('button', { name: '查看完整上下文' })).toBeVisible()
    expect(within(viewer).getByRole('button', { name: '打开原始来源' })).toBeVisible()
  })

  it('aggregates uploaded documents into knowledge topics instead of a document reader', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '知识库' }))
    expect(screen.queryByRole('button', { name: '原始文档' })).not.toBeInTheDocument()
    expect(screen.getByText('AI Agent 的基本结构')).toBeVisible()
    expect(screen.getByText('用户记忆与知识库')).toBeVisible()
    expect(screen.getByText('强化学习方法分类')).toBeVisible()

    await user.click(screen.getByText('用户记忆与知识库'))
    const source = screen.getByRole('button', { name: /深入理解-AI-Agent-李博杰-v1.2.pdf/ })
    expect(source).toBeVisible()
    expect(screen.queryByRole('button', { name: '历史变化（1）' })).not.toBeInTheDocument()
    await user.click(source)
    expect(within(screen.getByRole('dialog', { name: '来源' })).getByText('第 3 章 · 第 69 页')).toBeVisible()
  })

  it('routes homepage evidence and source collections through the shared source viewer', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '查看证据：13:45 前完成组队确认' }))
    expect(screen.getByRole('dialog', { name: '来源' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '关闭' }))

    await user.click(screen.getByRole('button', { name: '3 个来源' }))
    const picker = screen.getByRole('dialog', { name: '选择来源' })
    expect(within(picker).getByText('黑客松比赛说明.pdf')).toBeVisible()
    await user.click(within(picker).getByRole('button', { name: /赛程更新.png/ }))
    expect(within(screen.getByRole('dialog', { name: '来源' })).getByText('图片右上区域 · 12:51')).toBeVisible()
  })

  it('keeps detailed import and opens an independent global quick capture', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('button', { name: '导入新信息' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '快速接入' }))
    const dialog = screen.getByRole('dialog', { name: '快速接入' })
    expect(within(dialog).getByLabelText('新信息')).toBeVisible()
    expect(within(dialog).getByText(/当前目标/)).toBeVisible()
    expect(within(dialog).getByLabelText('上传音频')).toHaveAttribute('accept', 'audio/*')
  })

  it('opens quick capture by shortcut and simulates voice capture', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.keyboard('{Control>}k{/Control}')
    const dialog = screen.getByRole('dialog', { name: '快速接入' })
    await user.click(within(dialog).getByRole('button', { name: '开始语音输入' }))
    expect(within(dialog).getByRole('button', { name: '结束语音输入' })).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: '结束语音输入' }))
    expect(within(dialog).getByText('已接入一段语音')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: '接入信息' }))
    expect(within(dialog).getByText('归入：用户记忆与知识库')).toBeVisible()
  })
})

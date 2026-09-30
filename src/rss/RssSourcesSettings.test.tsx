import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RssSourcesSettings } from './RssSourcesSettings'
import type { RssSourceDto } from './types'

const sources: RssSourceDto[] = [
  { id: 'healthy', title: 'Example', url: 'https://example.com/feed.xml', status: 'active', frequency: 'adaptive', lastSuccessAt: '2026-09-30T03:00:00Z' },
  { id: 'failed', title: 'Broken Feed', url: 'https://broken.example/feed', status: 'error', frequency: 'daily', lastErrorMessage: '连接超时' },
]

describe('RSS settings', () => {
  it('keeps technical details collapsed and pauses a source', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn(async () => undefined)
    render(<RssSourcesSettings sources={sources} onUpdate={onUpdate} onRun={vi.fn()} />)
    expect(screen.getByText('Example')).toBeVisible()
    expect(screen.getByText('https://example.com/feed.xml')).not.toBeVisible()
    await user.click(screen.getByRole('button', { name: '暂停 Example' }))
    expect(onUpdate).toHaveBeenCalledWith('healthy', { status: 'paused' })
  })

  it('reveals failure details and allows a manual retry', async () => {
    const user = userEvent.setup()
    const onRun = vi.fn(async () => undefined)
    render(<RssSourcesSettings sources={sources} onUpdate={vi.fn()} onRun={onRun} />)
    const row = screen.getByTestId('rss-source-failed')
    expect(within(row).getByText('需要检查')).toBeVisible()
    await user.click(within(row).getByText('详情'))
    expect(within(row).getByText('连接超时')).toBeVisible()
    await user.click(within(row).getByRole('button', { name: '重新检查 Broken Feed' }))
    expect(onRun).toHaveBeenCalledWith('failed')
  })
})

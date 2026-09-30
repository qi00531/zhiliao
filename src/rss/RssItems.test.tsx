import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RssItems } from './RssItems'
import type { RssItemDto } from './types'

const items: RssItemDto[] = [
  { id: 'new', sourceId: 'source', sourceTitle: 'Example Feed', title: 'A real update', url: 'https://example.com/new', summaryText: 'Long feed summary', publishedAt: '2026-09-30T03:00:00Z', firstSeenAt: '2026-09-30T03:01:00Z', initialImport: false },
  { id: 'initial', sourceId: 'source', sourceTitle: 'Example Feed', title: 'Earlier context', url: 'https://example.com/old', summaryText: 'Old summary', publishedAt: '2026-09-29T03:00:00Z', firstSeenAt: '2026-09-30T02:00:00Z', initialImport: true },
]

describe('RSS homepage items', () => {
  it('keeps summaries collapsed and distinguishes new from initial imports', async () => {
    const user = userEvent.setup()
    render(<RssItems items={items} onEvidence={vi.fn()} />)
    const cards = screen.getAllByTestId('rss-item')
    expect(within(cards[0]).getByText('新信息')).toBeVisible()
    expect(within(cards[1]).getByText('首次导入')).toBeVisible()
    expect(screen.getAllByText(/Example Feed/)).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'A real update' })).toBeVisible()
    expect(screen.queryByText('Long feed summary')).not.toBeInTheDocument()
    await user.click(within(cards[0]).getByRole('button', { name: '查看详情' }))
    expect(screen.getByText('Long feed summary')).toBeVisible()
  })

  it('opens evidence through the shared viewer callback', async () => {
    const user = userEvent.setup()
    const onEvidence = vi.fn()
    render(<RssItems items={[items[0]]} onEvidence={onEvidence} />)
    await user.click(screen.getByRole('button', { name: '查看来源：A real update' }))
    expect(onEvidence).toHaveBeenCalledWith(items[0])
  })
})

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'

afterEach(() => vi.unstubAllGlobals())

describe('RSS source connection', () => {
  it('connects an RSS URL without replacing the existing import entry', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      source: { id: 'source-1', title: 'Example', url: 'https://example.com/feed.xml', status: 'active', frequency: 'adaptive' },
      initialItems: [],
    }), { status: 201, headers: { 'content-type': 'application/json' } })))
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '导入新信息' }))
    await user.click(screen.getByRole('button', { name: 'RSS' }))
    const dialog = screen.getByRole('dialog', { name: '接入 RSS' })
    await user.type(within(dialog).getByLabelText('RSS 地址'), 'https://example.com/feed.xml')
    await user.click(within(dialog).getByRole('button', { name: '接入' }))

    expect(await within(dialog).findByText('已接入 Example')).toBeVisible()
    expect(screen.getByRole('button', { name: '导入新信息' })).toBeVisible()
  })

  it('supports starting from now and shows a concise API error', async () => {
    const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      error: { code: 'UNSUPPORTED_FEED', message: '没有找到可读取的 Feed' },
    }), { status: 502, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', request)
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: '导入新信息' }))
    await user.click(screen.getByRole('button', { name: 'RSS' }))
    const dialog = screen.getByRole('dialog', { name: '接入 RSS' })
    await user.type(within(dialog).getByLabelText('RSS 地址'), 'https://example.com/feed.xml')
    await user.click(within(dialog).getByText('导入方式'))
    await user.click(within(dialog).getByLabelText('从现在开始'))
    await user.click(within(dialog).getByRole('button', { name: '接入' }))

    expect(await within(dialog).findByText('没有找到可读取的 Feed')).toBeVisible()
    const connectCall = request.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(connectCall?.[1]?.body))).toMatchObject({ initialMode: 'from-now' })
  })
})

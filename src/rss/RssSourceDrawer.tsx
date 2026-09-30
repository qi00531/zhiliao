import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, X } from 'lucide-react'
import type { RssInitialMode, RssSourceDto } from './types'

export function RssSourceDrawer({ onClose, onConnect }: {
  onClose: () => void
  onConnect: (url: string, mode: RssInitialMode) => Promise<RssSourceDto>
}) {
  const [url, setUrl] = useState('')
  const [mode, setMode] = useState<RssInitialMode>('latest-20')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState<RssSourceDto | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { input.current?.focus() }, [])

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      setConnected(await onConnect(url.trim(), mode))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '暂时无法接入')
    } finally {
      setBusy(false)
    }
  }

  return <div className="drawer-layer"><button className="drawer-backdrop" aria-label="关闭 RSS 接入" onClick={onClose} />
    <aside className="drawer rss-drawer" role="dialog" aria-modal="true" aria-label="接入 RSS">
      <div className="drawer__header"><div><span className="eyebrow">RSS</span><h2>接入信源</h2></div><button className="icon-button" aria-label="关闭" onClick={onClose}><X size={20} /></button></div>
      {connected ? <div className="rss-connected"><Check size={20} /><strong>已接入 {connected.title}</strong><button onClick={onClose}>完成</button></div> : <>
        <label className="rss-url"><span>RSS 地址</span><input ref={input} aria-label="RSS 地址" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/feed.xml" /></label>
        <details className="rss-import-mode"><summary>导入方式</summary>
          <label><input type="radio" name="rss-mode" checked={mode === 'latest-20'} onChange={() => setMode('latest-20')} />最近 20 条</label>
          <label><input aria-label="从现在开始" type="radio" name="rss-mode" checked={mode === 'from-now'} onChange={() => setMode('from-now')} />从现在开始</label>
        </details>
        {error && <p className="rss-error" role="alert">{error}</p>}
        <button className="analyze-button" disabled={busy || !url.trim()} onClick={submit}>{busy ? '正在接入…' : <>接入<ArrowRight size={17} /></>}</button>
      </>}
    </aside>
  </div>
}

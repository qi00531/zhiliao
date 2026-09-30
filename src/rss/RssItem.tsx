import { useState } from 'react'
import { ChevronDown, Link2 } from 'lucide-react'
import type { RssItemDto } from './types'

const itemTime = (item: RssItemDto) => new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date(item.publishedAt ?? item.firstSeenAt))

export function RssItem({ item, onEvidence }: { item: RssItemDto; onEvidence: (item: RssItemDto) => void }) {
  const [open, setOpen] = useState(false)
  return <article className="signal signal--new rss-item" data-testid="rss-item">
    <div className="signal__rail" aria-hidden="true"><span>+</span></div>
    <div className="signal__body">
      <div className="signal__meta"><span className="signal__kind">{item.initialImport ? '首次导入' : '新信息'}</span><span>{item.sourceTitle} · {itemTime(item)}</span></div>
      <h2>{item.title}</h2>
      <div className="signal__actions">
        {item.summaryText && <button className="text-action" aria-expanded={open} aria-label="查看详情" onClick={() => setOpen(!open)}>查看详情<ChevronDown className={open ? 'is-open' : ''} size={14} /></button>}
        <button className="text-action text-action--evidence" aria-label={`查看来源：${item.title}`} onClick={() => onEvidence(item)}><Link2 size={14} />查看来源</button>
      </div>
      {open && <p className="rss-item__summary">{item.summaryText}</p>}
    </div>
  </article>
}

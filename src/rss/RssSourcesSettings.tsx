import type { RssFrequency, RssSourceDto } from './types'

const labels: Record<RssFrequency, string> = {
  adaptive: '自适应', immediate: '尽快', daily: '每天', weekly: '每周', manual: '仅手动',
}

const lastChecked = (source: RssSourceDto) => source.lastSuccessAt
  ? `最近检查 ${new Date(source.lastSuccessAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}`
  : source.status === 'error' ? '需要检查' : '等待首次检查'

export function RssSourcesSettings({ sources, onUpdate, onRun }: {
  sources: RssSourceDto[]
  onUpdate: (id: string, changes: Partial<Pick<RssSourceDto, 'status' | 'frequency'>>) => Promise<unknown>
  onRun: (id: string) => Promise<unknown>
}) {
  if (!sources.length) return null
  return <div className="settings-group rss-settings"><h2>RSS 信源</h2>{sources.map((source) => <div className="rss-source-setting" data-testid={`rss-source-${source.id}`} key={source.id}>
    <div className="rss-source-setting__main"><span><strong>{source.title}</strong><small>{lastChecked(source)}</small></span>
      <select aria-label={`${source.title} 检查频率`} value={source.frequency} onChange={(event) => { void onUpdate(source.id, { frequency: event.target.value as RssFrequency }) }}>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
      <button aria-label={`${source.status === 'paused' ? '继续' : '暂停'} ${source.title}`} onClick={() => { void onUpdate(source.id, { status: source.status === 'paused' ? 'active' : 'paused' }) }}>{source.status === 'paused' ? '继续' : '暂停'}</button>
    </div>
    <details><summary>详情</summary><dl><div><dt>地址</dt><dd>{source.url}</dd></div>{source.lastErrorMessage && <div><dt>状态</dt><dd>{source.lastErrorMessage}</dd></div>}</dl>{source.status === 'error' && <button aria-label={`重新检查 ${source.title}`} onClick={() => { void onRun(source.id) }}>重新检查</button>}</details>
  </div>)}</div>
}

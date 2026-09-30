import type { RssItemDto } from './types'
import { RssItem } from './RssItem'

export function RssItems({ items, onEvidence }: { items: RssItemDto[]; onEvidence: (item: RssItemDto) => void }) {
  return <>{items.map((item) => <RssItem key={item.id} item={item} onEvidence={onEvidence} />)}</>
}

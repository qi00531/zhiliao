import { useCallback, useState } from 'react'
import { rssApi } from './api'
import type { RssInitialMode, RssItemDto, RssSourceDto } from './types'

export function useRss() {
  const [sources, setSources] = useState<RssSourceDto[]>([])
  const [items, setItems] = useState<RssItemDto[]>([])

  const connect = useCallback(async (url: string, mode: RssInitialMode) => {
    const result = await rssApi.connect(url, mode)
    setSources((current) => [result.source, ...current.filter((source) => source.id !== result.source.id)])
    setItems((current) => [...result.initialItems, ...current])
    return result.source
  }, [])

  const load = useCallback(async () => {
    const [nextSources, nextItems] = await Promise.all([rssApi.listSources(), rssApi.listItems()])
    setSources(nextSources)
    setItems(nextItems)
  }, [])

  return { sources, items, connect, load, setSources, setItems }
}

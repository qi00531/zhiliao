import { useCallback, useState } from 'react'
import { rssApi } from './api'
import type { RssInitialMode, RssItemDto, RssSourceDto } from './types'

export function useRss() {
  const [sources, setSources] = useState<RssSourceDto[]>([])
  const [items, setItems] = useState<RssItemDto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const connect = useCallback(async (url: string, mode: RssInitialMode) => {
    const result = await rssApi.connect(url, mode)
    setSources((current) => [result.source, ...current.filter((source) => source.id !== result.source.id)])
    setItems((current) => [...result.initialItems, ...current])
    return result.source
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextSources, nextItems] = await Promise.all([rssApi.listSources(), rssApi.listItems()])
      setSources(nextSources)
      setItems(nextItems)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '暂时无法读取 RSS')
    } finally {
      setLoading(false)
    }
  }, [])

  const updateSource = useCallback(async (id: string, changes: Partial<Pick<RssSourceDto, 'status' | 'frequency'>>) => {
    const updated = await rssApi.updateSource(id, changes)
    setSources((current) => current.map((source) => source.id === id ? { ...source, ...updated } : source))
  }, [])

  const runSource = useCallback(async (id: string) => {
    await rssApi.runSource(id)
    await load()
  }, [load])

  return { sources, items, loading, error, connect, load, updateSource, runSource, setSources, setItems }
}

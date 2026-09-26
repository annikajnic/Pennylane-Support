import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { useRole } from '../role'

interface Page<TItem> {
  items: TItem[]
  page: number
  totalPages: number
}

interface Loaded<TPage> {
  key: string
  pages: TPage[]
  error: Error | null
}

// Loads a paginated list one page at a time. `basePath` holds the filters
// (without page params); when it or the role changes the list starts over at
// page 1. The previous results stay visible until the new first page arrives,
// so changing a filter doesn't flash an empty grid.
export function useInfiniteApi<TItem, TPage extends Page<TItem>>(basePath: string, pageSize: number) {
  const { role } = useRole()
  const key = `${role}|${basePath}|${pageSize}`

  const [loaded, setLoaded] = useState<Loaded<TPage>>({ key: '', pages: [], error: null })
  // How many pages the UI wants for the current key.
  const [wanted, setWanted] = useState({ key, count: 1 })
  const [retryCount, setRetryCount] = useState(0)

  const isCurrent = loaded.key === key
  const pages = isCurrent ? loaded.pages : []
  const wantedCount = wanted.key === key ? wanted.count : 1
  const error = isCurrent ? loaded.error : null
  const nextPage = pages.length + 1
  const needsFetch = pages.length < wantedCount && !error

  useEffect(() => {
    if (!needsFetch) return
    let cancelled = false
    const separator = basePath.includes('?') ? '&' : '?'
    apiFetch<TPage>(`${basePath}${separator}page=${nextPage}&pageSize=${pageSize}`, role)
      .then((data) => {
        if (cancelled) return
        setLoaded((prev) => {
          // Append only if this is the page that comes next for this key.
          const base = prev.key === key ? prev.pages : []
          if (base.length !== nextPage - 1) return prev
          return { key, pages: [...base, data], error: null }
        })
      })
      .catch((err: Error) => {
        if (cancelled) return
        setLoaded((prev) => ({ key, pages: prev.key === key ? prev.pages : [], error: err }))
      })
    return () => {
      cancelled = true
    }
  }, [needsFetch, basePath, nextPage, pageSize, role, key, retryCount])

  const lastPage = pages[pages.length - 1]
  const hasMore = lastPage ? lastPage.page < lastPage.totalPages : false
  const loading = needsFetch

  const loadMore = useCallback(() => {
    if (!hasMore || loading) return
    setWanted({ key, count: wantedCount + 1 })
  }, [hasMore, loading, key, wantedCount])

  // Retry the failed page without discarding what's already loaded.
  const retry = useCallback(() => {
    setLoaded((prev) => ({ ...prev, error: null }))
    setRetryCount((n) => n + 1)
  }, [])

  // While a new filter's first page loads, keep showing the old results.
  const shownPages = pages.length > 0 ? pages : loaded.pages

  return {
    items: shownPages.flatMap((p) => p.items),
    firstPage: shownPages[0] ?? null,
    isStale: !isCurrent,
    hasMore,
    loading,
    error,
    loadMore,
    retry,
  }
}

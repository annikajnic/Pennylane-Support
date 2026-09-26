import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { useRole } from '../role'

interface Result<T> {
  key: string
  data: T | null
  error: Error | null
}

// GETs `path` and refetches whenever the path or the viewer's role changes,
// since the role changes what the server returns. Pass null to skip fetching.
// The previous data stays available while a new request is in flight, so
// lists don't flash empty when a filter changes.
export function useApi<T>(path: string | null) {
  const { role } = useRole()
  const [reloadCount, setReloadCount] = useState(0)
  const [result, setResult] = useState<Result<T>>({ key: '', data: null, error: null })

  const key = `${role}|${path}|${reloadCount}`

  useEffect(() => {
    if (path === null) return
    let cancelled = false
    apiFetch<T>(path, role)
      .then((data) => !cancelled && setResult({ key, data, error: null }))
      .catch((error: Error) => !cancelled && setResult({ key, data: null, error }))
    return () => {
      cancelled = true
    }
  }, [key, path, role])

  const reload = useCallback(() => setReloadCount((n) => n + 1), [])

  return {
    data: result.data,
    // Only surface an error for the current request, not a stale one.
    error: result.key === key ? result.error : null,
    loading: path !== null && result.key !== key,
    reload,
  }
}

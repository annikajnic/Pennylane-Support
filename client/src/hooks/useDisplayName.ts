import { useState } from 'react'

const STORAGE_KEY = 'pl-support-display-name'

// No accounts, so the poster's name is typed once and remembered per browser.
export function useDisplayName() {
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? ''
    } catch {
      return ''
    }
  })

  function remember(value: string) {
    setName(value)
    try {
      localStorage.setItem(STORAGE_KEY, value.trim())
    } catch {
      // Storage unavailable — the name just won't persist.
    }
  }

  return [name, remember] as const
}

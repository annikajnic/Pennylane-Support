import { useEffect, useState } from 'react'

const SEARCH_DEBOUNCE_MS = 300

// Search runs on the server, so typing is debounced before `onChange` fires
// (which typically updates the URL and triggers a fetch).
export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
}) {
  const [draft, setDraft] = useState(value)
  const [lastValue, setLastValue] = useState(value)

  // Pick up external changes (e.g. "Clear") without an effect. Changes that
  // came from this input are skipped so a trailing space isn't eaten mid-typing.
  if (value !== lastValue) {
    setLastValue(value)
    if (value !== draft.trim()) setDraft(value)
  }

  useEffect(() => {
    if (draft.trim() === value) return
    const timer = setTimeout(() => onChange(draft.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [draft, value, onChange])

  return (
    <input
      type="search"
      className="input"
      placeholder={placeholder}
      aria-label={label}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
    />
  )
}

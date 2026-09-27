export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = minutes / 60
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Card previews show plain text: drop code blocks, headings, tables, rules,
// and inline Markdown syntax, then take the first `max` characters.
export function plainExcerpt(markdown: string, max = 140): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s+.*$/gm, ' ')
    .replace(/^\s*\|.*$/gm, ' ') // table rows
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, ' ') // horizontal rules
    .replace(/^\s*(?:[-*+]|\d+\.|>)\s+/gm, '')
    .replace(/\[[ xX]\]\s*/g, '') // task-list checkboxes
    .replace(/[*`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}

const YEAR_SECONDS = 365 * 24 * 3600

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['month', YEAR_SECONDS / 12],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

// "3 days ago", "last month", "just now". A year or more away shows the date
// instead ("Jan 17, 2024"), which is more useful than "2 years ago".
export function formatRelative(iso: string, now = Date.now()): string {
  const seconds = (new Date(iso).getTime() - now) / 1000
  if (Math.abs(seconds) >= YEAR_SECONDS) return formatDate(iso)
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) < size) continue
    const value = Math.round(seconds / size)
    // Close to a year would round to "12 months ago"; show the date instead.
    if (unit === 'month' && Math.abs(value) >= 12) return formatDate(iso)
    return relativeFormatter.format(value, unit)
  }
  return 'just now'
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 48) return `${hours.toFixed(1)} h`
  return `${(hours / 24).toFixed(1)} days`
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

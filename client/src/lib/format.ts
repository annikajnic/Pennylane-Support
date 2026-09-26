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

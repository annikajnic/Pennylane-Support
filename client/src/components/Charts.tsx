import { useState, type ReactNode } from 'react'

export interface Segment {
  key: string
  label: string
  value: number
  color: string
}

// A segment only gets an inline label when it's wide enough to hold one;
// otherwise the legend and tooltip carry it.
const MIN_LABEL_SHARE = 0.08

function percent(value: number, total: number) {
  return total === 0 ? 0 : value / total
}

function formatShare(share: number) {
  return `${Math.round(share * 100)}%`
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="chart-legend">
      {items.map((item) => (
        <li key={item.label}>
          <span className="legend-swatch" style={{ background: item.color }} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

// One horizontal part-to-whole bar with a legend and hover/focus tooltips.
export function StackedBar({ segments, label }: { segments: Segment[]; label: string }) {
  const [active, setActive] = useState<string | null>(null)
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const activeSegment = segments.find((s) => s.key === active)

  // Tooltip is centred over the active segment.
  let offset = 0
  let tooltipLeft = 0
  for (const s of segments) {
    const share = percent(s.value, total)
    if (s.key === active) tooltipLeft = offset + share / 2
    offset += share
  }

  return (
    <figure className="chart">
      <Legend items={segments.map((s) => ({ label: s.label, color: s.color }))} />
      <div className="stacked-bar-wrap">
        <div className="stacked-bar" role="img" aria-label={label}>
          {segments.map((s) => {
            const share = percent(s.value, total)
            if (share === 0) return null
            return (
              <div
                key={s.key}
                className={`stacked-segment ${active && active !== s.key ? 'dimmed' : ''}`}
                style={{ flexGrow: s.value, background: s.color }}
                tabIndex={0}
                aria-label={`${s.label}: ${s.value} (${formatShare(share)})`}
                onMouseEnter={() => setActive(s.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(s.key)}
                onBlur={() => setActive(null)}
              >
                {share >= MIN_LABEL_SHARE && (
                  <span className="segment-label">
                    {s.value} · {formatShare(share)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        {activeSegment && (
          <div className="chart-tooltip" style={{ left: `${tooltipLeft * 100}%` }} role="status">
            <strong>{activeSegment.label}</strong>
            <span>
              {activeSegment.value} of {total} ({formatShare(percent(activeSegment.value, total))})
            </span>
          </div>
        )}
      </div>
    </figure>
  )
}

export interface BarRow {
  key: string
  label: ReactNode
  // Stacked parts of this row's bar, in legend order.
  parts: { value: number; color: string; label: string }[]
  valueLabel: string
  tooltip?: string
}

// Ranked horizontal bars; the value sits at each bar's tip and a tooltip adds
// detail on hover/focus. All rows share one scale.
export function BarList({ rows, legend }: { rows: BarRow[]; legend?: { label: string; color: string }[] }) {
  const [active, setActive] = useState<string | null>(null)
  const max = Math.max(1, ...rows.map((r) => r.parts.reduce((sum, p) => sum + p.value, 0)))

  return (
    <figure className="chart">
      {legend && <Legend items={legend} />}
      <ul className="bar-list">
        {rows.map((row) => {
          const rowTotal = row.parts.reduce((sum, p) => sum + p.value, 0)
          return (
            <li
              key={row.key}
              className={`bar-row ${active && active !== row.key ? 'dimmed' : ''}`}
              tabIndex={row.tooltip ? 0 : undefined}
              onMouseEnter={() => setActive(row.key)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(row.key)}
              onBlur={() => setActive(null)}
            >
              <div className="bar-label">{row.label}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(rowTotal / max) * 100}%` }}>
                  {row.parts.map(
                    (p) =>
                      p.value > 0 && (
                        <span
                          key={p.label}
                          className="bar-part"
                          style={{ flexGrow: p.value, background: p.color }}
                        />
                      ),
                  )}
                </div>
                <span className="bar-value">{row.valueLabel}</span>
                {active === row.key && row.tooltip && (
                  <div className="chart-tooltip bar-tooltip" role="status">
                    {row.tooltip}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </figure>
  )
}

// Every chart gets an accessible table twin, collapsed by default.
export function TableView({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <details className="table-view">
      <summary>Show as table</summary>
      <table>
        <caption className="visually-hidden">{caption}</caption>
        {children}
      </table>
    </details>
  )
}

export function StatTile({
  label,
  value,
  detail,
  accent,
}: {
  label: string
  value: string
  detail?: string
  accent?: 'blue' | 'pink' | 'yellow'
}) {
  return (
    <div className={`stat-tile ${accent ? `stat-tile-${accent}` : ''}`}>
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value">{value}</div>
      {detail && <div className="stat-tile-detail">{detail}</div>}
    </div>
  )
}

import { Link } from 'react-router-dom'
import type { ConversationStatus, Insights } from '../api/types'
import { PriorityBadge } from '../components/Badges'
import {
  BarList,
  StackedBar,
  StatTile,
  TableView,
  type Segment,
} from '../components/Charts'
import { ErrorMessage, Loading } from '../components/Status'
import { SERIES_COLORS } from '../lib/chartColors'
import { useApi } from '../hooks/useApi'
import { capitalize, formatHours } from '../lib/format'
import { useRole } from '../role'

// Each status keeps the same colour wherever it appears (badges and charts).
const STATUS_COLORS: Record<ConversationStatus, string> = {
  open: SERIES_COLORS.pink,
  answered: SERIES_COLORS.green,
  resolved: SERIES_COLORS.blue,
  closed: SERIES_COLORS.violet,
}
const UNRESOLVED_COLOR = SERIES_COLORS.pink
const RESOLVED_COLOR = SERIES_COLORS.blue

export function InsightsPage() {
  const { role, setRole } = useRole()

  // The API also rejects learners; this just explains why instead of showing a 403.
  if (role !== 'support') {
    return (
      <div className="empty access-notice">
        <h1>Insights are for the support team</h1>
        <p>Switch to the support view to see queue health and resolution times.</p>
        <button type="button" className="button button-primary" onClick={() => setRole('support')}>
          Switch to support
        </button>
      </div>
    )
  }

  return <SupportInsights />
}

function SupportInsights() {
  const { data, error, loading, reload } = useApi<Insights>('/insights')

  if (error) return <ErrorMessage error={error} onRetry={reload} />
  if (!data) return <Loading label="Loading insights…" />

  const { conversations: conv, resolution, topChallenges, workload } = data
  const statuses = Object.keys(STATUS_COLORS) as ConversationStatus[]
  const statusSegments: Segment[] = statuses.map((s) => ({
    key: s,
    label: capitalize(s),
    value: conv.byStatus[s] ?? 0,
    color: STATUS_COLORS[s],
  }))
  const unassigned = workload.find((w) => w.assignee === null)?.unresolvedCount ?? 0
  const unresolvedLabel = conv.unresolvedStatuses.join(' + ')
  const resolvedLabel = conv.resolvedStatuses.join(' + ')

  return (
    <div className={loading ? 'refreshing' : undefined}>
      <div className="page-header">
        <h1>Insights</h1>
        <p className="muted">Support queue health across all {conv.total} conversations.</p>
      </div>

      <div className="stat-tiles">
        <StatTile
          label="Unresolved"
          value={conv.unresolved.toLocaleString()}
          detail={unresolvedLabel}
          accent="pink"
        />
        <StatTile
          label="Resolved"
          value={conv.resolved.toLocaleString()}
          detail={resolvedLabel}
          accent="blue"
        />
        <StatTile
          label="Average resolution time"
          value={resolution.averageHours === null ? '–' : formatHours(resolution.averageHours)}
          detail={
            resolution.medianHours === null
              ? undefined
              : `median ${formatHours(resolution.medianHours)} · ${resolution.resolvedCount} resolved`
          }
          accent="yellow"
        />
        <StatTile
          label="Unassigned & unresolved"
          value={unassigned.toLocaleString()}
          detail="waiting for an owner"
        />
      </div>

      <section className="card chart-card">
        <h2>Open vs resolved</h2>
        <p className="muted chart-subtitle">
          Unresolved = {unresolvedLabel}; resolved = {resolvedLabel}.
        </p>
        <StackedBar segments={statusSegments} label="Conversations by status" />
        <TableView caption="Conversations by status">
          <thead>
            <tr>
              <th>Status</th>
              <th>Conversations</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>
            {statusSegments.map((s) => (
              <tr key={s.key}>
                <td>{s.label}</td>
                <td>{s.value}</td>
                <td>{conv.total ? Math.round((s.value / conv.total) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </TableView>
      </section>

      <div className="insights-grid">
        <section className="card chart-card">
          <h2>Most asked-about challenges</h2>
          <p className="muted chart-subtitle">Top {topChallenges.length} by number of conversations.</p>
          <BarList
            legend={[
              { label: 'Unresolved', color: UNRESOLVED_COLOR },
              { label: 'Resolved', color: RESOLVED_COLOR },
            ]}
            rows={topChallenges.map((c) => ({
              key: c.id,
              label: (
                <Link to={`/conversations?challengeId=${c.id}`} title={`${c.title} (${c.id})`}>
                  {c.title}
                </Link>
              ),
              parts: [
                { label: 'Unresolved', value: c.unresolvedCount, color: UNRESOLVED_COLOR },
                {
                  label: 'Resolved',
                  value: c.conversationCount - c.unresolvedCount,
                  color: RESOLVED_COLOR,
                },
              ],
              valueLabel: String(c.conversationCount),
              tooltip: `${c.id}: ${c.unresolvedCount} unresolved, ${c.conversationCount - c.unresolvedCount} resolved`,
            }))}
          />
          <TableView caption="Most asked-about challenges">
            <thead>
              <tr>
                <th>Challenge</th>
                <th>Conversations</th>
                <th>Unresolved</th>
              </tr>
            </thead>
            <tbody>
              {topChallenges.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.title} <span className="challenge-id">{c.id}</span>
                  </td>
                  <td>{c.conversationCount}</td>
                  <td>{c.unresolvedCount}</td>
                </tr>
              ))}
            </tbody>
          </TableView>
        </section>

        <div className="insights-column">
          <section className="card chart-card">
            <h2>Unresolved workload</h2>
            <p className="muted chart-subtitle">Open + answered conversations per assignee.</p>
            <BarList
              rows={workload.map((w) => ({
                key: w.assignee ?? 'unassigned',
                label: w.assignee ? (
                  <Link to={`/conversations?assignedTo=${w.assignee}&status=unresolved`}>{w.assignee}</Link>
                ) : (
                  <Link to="/conversations?assignedTo=unassigned&status=unresolved" className="unassigned">
                    Unassigned
                  </Link>
                ),
                parts: [{ label: 'Unresolved', value: w.unresolvedCount, color: UNRESOLVED_COLOR }],
                valueLabel: String(w.unresolvedCount),
              }))}
            />
            <TableView caption="Unresolved workload per assignee">
              <thead>
                <tr>
                  <th>Assignee</th>
                  <th>Unresolved</th>
                </tr>
              </thead>
              <tbody>
                {workload.map((w) => (
                  <tr key={w.assignee ?? 'unassigned'}>
                    <td>{w.assignee ?? 'Unassigned'}</td>
                    <td>{w.unresolvedCount}</td>
                  </tr>
                ))}
              </tbody>
            </TableView>
          </section>

          <section className="card chart-card">
            <h2>Resolution time by priority</h2>
            <p className="muted chart-subtitle">Average hours from start to resolution.</p>
            <BarList
              rows={resolution.byPriority.map((p) => ({
                key: p.priority,
                label: <PriorityBadge priority={p.priority} />,
                parts: [{ label: 'Hours', value: p.averageHours ?? 0, color: RESOLVED_COLOR }],
                valueLabel: p.averageHours === null ? '–' : formatHours(p.averageHours),
                tooltip: `${p.resolvedCount} resolved conversations`,
              }))}
            />
            <TableView caption="Average resolution time by priority">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Average</th>
                  <th>Resolved</th>
                </tr>
              </thead>
              <tbody>
                {resolution.byPriority.map((p) => (
                  <tr key={p.priority}>
                    <td>{capitalize(p.priority)}</td>
                    <td>{p.averageHours === null ? '–' : formatHours(p.averageHours)}</td>
                    <td>{p.resolvedCount}</td>
                  </tr>
                ))}
              </tbody>
            </TableView>
          </section>
        </div>
      </div>
    </div>
  )
}

import { Link, useSearchParams } from 'react-router-dom'
import { toQuery } from '../api/client'
import type { ConversationList, ConversationSummary } from '../api/types'
import { ConversationStatusBadge, PriorityBadge, Tag } from '../components/Badges'
import { SearchInput } from '../components/SearchInput'
import { ErrorMessage, Loading } from '../components/Status'
import { useApi } from '../hooks/useApi'
import { capitalize, formatDateTime, formatRelative } from '../lib/format'
import { useRole } from '../role'

const PAGE_SIZE = 20

// Filters and page live in the URL so views are shareable and survive
// navigating into a conversation and back.
export function ConversationsPage() {
  const { role } = useRole()
  const isSupport = role === 'support'
  const [params, setParams] = useSearchParams()

  const status = params.get('status') ?? ''
  const challengeId = params.get('challengeId') ?? ''
  const search = params.get('q') ?? ''
  const assignedTo = isSupport ? (params.get('assignedTo') ?? '') : ''
  const priority = isSupport ? (params.get('priority') ?? '') : ''
  const page = Math.max(1, Number(params.get('page')) || 1)

  const { data, error, loading, reload } = useApi<ConversationList>(
    `/conversations${toQuery({
      status,
      challengeId,
      q: search,
      assignedTo,
      priority,
      page: String(page),
      pageSize: String(PAGE_SIZE),
    })}`,
  )

  // Any filter change goes back to page 1.
  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setParams(next, { replace: true })
  }

  function goToPage(n: number) {
    const next = new URLSearchParams(params)
    if (n > 1) next.set('page', String(n))
    else next.delete('page')
    setParams(next)
    window.scrollTo({ top: 0 })
  }

  const hasFilters = Boolean(status || challengeId || search || assignedTo || priority)
  // The challenge title comes from any matching row; fall back to the bare ID.
  const challengeTitle = data?.items.find((c) => c.challenge.id === challengeId)?.challenge.title

  return (
    <>
      <div className="page-header page-header-row">
        <div>
          <h1>Conversations</h1>
          <p className="muted">
            {isSupport
              ? 'Triage the support queue: filter, assign, and update status.'
              : 'Questions and answers from the community about PennyLane challenges.'}
          </p>
        </div>
        <Link
          to={`/conversations/new${toQuery({ challengeId })}`}
          className="button button-primary"
        >
          + New conversation
        </Link>
      </div>

      {challengeId && (
        <div className="filter-chip">
          Challenge:{' '}
          <Link to={`/challenges/${challengeId}`}>
            {challengeTitle ? `${challengeTitle} (${challengeId})` : challengeId}
          </Link>
          <button
            type="button"
            aria-label="Remove challenge filter"
            onClick={() => setFilter('challengeId', '')}
          >
            ×
          </button>
        </div>
      )}

      <div className="filters">
        <SearchInput
          value={search}
          onChange={(v) => setFilter('q', v)}
          placeholder="Search topics"
          label="Search conversations"
        />
        <select
          className="input"
          aria-label="Status"
          value={status}
          onChange={(e) => setFilter('status', e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="unresolved">Unresolved (open + answered)</option>
          {data?.facets.statuses.map((s) => (
            <option key={s} value={s}>
              {capitalize(s)}
            </option>
          ))}
        </select>
        {isSupport && (
          <>
            <select
              className="input"
              aria-label="Assigned to"
              value={assignedTo}
              onChange={(e) => setFilter('assignedTo', e.target.value)}
            >
              <option value="">Anyone</option>
              <option value="unassigned">Unassigned</option>
              {data?.facets.assignees.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select
              className="input"
              aria-label="Priority"
              value={priority}
              onChange={(e) => setFilter('priority', e.target.value)}
            >
              <option value="">All priorities</option>
              {data?.facets.priorities.map((p) => (
                <option key={p} value={p}>
                  {capitalize(p)}
                </option>
              ))}
            </select>
          </>
        )}
        {hasFilters && (
          <button type="button" className="button button-quiet" onClick={() => setParams({})}>
            Clear
          </button>
        )}
      </div>

      {error ? (
        <ErrorMessage error={error} onRetry={reload} />
      ) : !data ? (
        <Loading label="Loading conversations…" />
      ) : (
        <>
          <p className="muted result-count" aria-live="polite">
            {data.total} {data.total === 1 ? 'conversation' : 'conversations'}
            {loading && ' · updating…'}
          </p>
          {data.items.length === 0 ? (
            <div className="empty">No conversations match these filters.</div>
          ) : (
            <ul className="conversation-list">
              {data.items.map((c) => (
                <li key={c.id}>
                  <ConversationRow conversation={c} showTriage={isSupport} />
                </li>
              ))}
            </ul>
          )}
          {data.totalPages > 1 && (
            <nav className="pagination" aria-label="Pagination">
              <button
                type="button"
                className="button"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                ← Previous
              </button>
              <span className="muted">
                Page {data.page} of {data.totalPages}
              </span>
              <button
                type="button"
                className="button"
                disabled={page >= data.totalPages}
                onClick={() => goToPage(page + 1)}
              >
                Next →
              </button>
            </nav>
          )}
        </>
      )}
    </>
  )
}

function ConversationRow({
  conversation: c,
  showTriage,
}: {
  conversation: ConversationSummary
  showTriage: boolean
}) {
  return (
    <Link to={`/conversations/${c.id}`} className="card conversation-row">
      <div className="conversation-main">
        <div className="conversation-title-line">
          <ConversationStatusBadge status={c.status} />
          {c.isPinned && (
            <span className="icon-flag" title="Pinned">
              📌
            </span>
          )}
          {c.isLocked && (
            <span className="icon-flag" title="Locked">
              🔒
            </span>
          )}
          <h2 className="conversation-topic">{c.topic}</h2>
        </div>
        <div className="conversation-meta">
          <span>
            {c.challenge.title} <span className="challenge-id">{c.challenge.id}</span>
          </span>
          <span>{c.category}</span>
          {c.hasAcceptedAnswer && <span className="accepted-flag">✓ Accepted answer</span>}
        </div>
        {c.tags.length > 0 && (
          <div className="tags">
            {c.tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        )}
      </div>
      <div className="conversation-side">
        {showTriage && (
          <div className="triage-line">
            <PriorityBadge priority={c.priority} />
            <span className={c.assignedTo ? '' : 'unassigned'}>
              {c.assignedTo ?? 'Unassigned'}
            </span>
          </div>
        )}
        <div className="conversation-counts">
          <span title="Posts">💬 {c.postCount}</span>
          <span title="Participants">👥 {c.participantCount}</span>
        </div>
        <time className="muted" dateTime={c.lastActivityAt} title={formatDateTime(c.lastActivityAt)}>
          {formatRelative(c.lastActivityAt)}
        </time>
      </div>
    </Link>
  )
}

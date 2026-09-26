import { useMemo } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { toQuery } from '../api/client'
import type { ChallengeList, ChallengeSummary } from '../api/types'
import { DifficultyBadge, StatusBadge, Tag } from '../components/Badges'
import { ErrorMessage, Loading } from '../components/Status'
import { useApi } from '../hooks/useApi'
import { formatMinutes, formatPercent, plainExcerpt } from '../lib/format'
import { useRole } from '../role'

// Filters live in the URL so a filtered view can be bookmarked or shared, and
// survives navigating to a challenge and back.
export function ChallengesPage() {
  const { role } = useRole()
  const [params, setParams] = useSearchParams()
  const category = params.get('category') ?? ''
  const difficulty = params.get('difficulty') ?? ''
  const status = params.get('status') ?? ''
  const search = params.get('q') ?? ''

  // Category/difficulty/status are filtered by the API; the text search runs
  // client-side over the (at most ~120) results.
  const { data, error, loading, reload } = useApi<ChallengeList>(
    `/challenges${toQuery({ category, difficulty, status: role === 'support' ? status : undefined })}`,
  )

  const visible = useMemo(() => {
    const items = data?.items ?? []
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }, [data, search])

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const hasFilters = Boolean(category || difficulty || status || search)

  return (
    <>
      <div className="page-header">
        <h1>Challenges</h1>
        <p className="muted">
          {role === 'support'
            ? 'All challenges, including drafts and archived ones.'
            : 'Browse PennyLane coding challenges and find help on the ones you’re working on.'}
        </p>
      </div>

      <div className="filters">
        <input
          type="search"
          className="input"
          placeholder="Search by title, ID, or tag"
          aria-label="Search challenges"
          value={search}
          onChange={(e) => setParam('q', e.target.value)}
        />
        <select
          className="input"
          aria-label="Category"
          value={category}
          onChange={(e) => setParam('category', e.target.value)}
        >
          <option value="">All categories</option>
          {data?.facets.categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          className="input"
          aria-label="Difficulty"
          value={difficulty}
          onChange={(e) => setParam('difficulty', e.target.value)}
        >
          <option value="">All difficulties</option>
          {data?.facets.difficulties.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        {role === 'support' && (
          <select
            className="input"
            aria-label="Status"
            value={status}
            onChange={(e) => setParam('status', e.target.value)}
          >
            <option value="">All statuses</option>
            {data?.facets.statuses.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
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
        <Loading label="Loading challenges…" />
      ) : (
        <>
          <p className="muted result-count" aria-live="polite">
            {visible.length} {visible.length === 1 ? 'challenge' : 'challenges'}
            {loading && ' · updating…'}
          </p>
          {visible.length === 0 ? (
            <div className="empty">No challenges match these filters.</div>
          ) : (
            <ul className="challenge-grid">
              {visible.map((c) => (
                <li key={c.id}>
                  <ChallengeCard challenge={c} showStatus={role === 'support'} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}

function ChallengeCard({
  challenge: c,
  showStatus,
}: {
  challenge: ChallengeSummary
  showStatus: boolean
}) {
  const location = useLocation()

  return (
    // Passing the current search lets the detail page link back to this exact filtered view.
    <Link to={`/challenges/${c.id}`} state={{ from: location.search }} className="card challenge-card">
      <div className="card-top">
        <span className="challenge-id">{c.id}</span>
        <DifficultyBadge difficulty={c.difficulty} />
        {showStatus && c.status !== 'published' && <StatusBadge status={c.status} />}
        <span className="points">{c.points} pts</span>
      </div>
      <h2 className="challenge-title">{c.title}</h2>
      <p className="challenge-category">{c.category}</p>
      <p className="challenge-excerpt">{plainExcerpt(c.description)}</p>
      <div className="tags">
        {c.tags.map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
      </div>
      <div className="card-stats">
        <span title="Estimated time">⏱ {formatMinutes(c.estimatedMinutes)}</span>
        <span title="Completion rate">✓ {formatPercent(c.completionRate)} complete</span>
        <span title="Support conversations">💬 {c.conversationCount}</span>
      </div>
    </Link>
  )
}

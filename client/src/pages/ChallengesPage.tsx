import { useEffect, useRef } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { toQuery } from '../api/client'
import type { ChallengeList, ChallengeSummary } from '../api/types'
import { DifficultyBadge, StatusBadge, Tag } from '../components/Badges'
import { SearchInput } from '../components/SearchInput'
import { ErrorMessage, Loading } from '../components/Status'
import { useInfiniteApi } from '../hooks/useInfiniteApi'
import { formatMinutes, formatPercent, plainExcerpt } from '../lib/format'
import { useRole } from '../role'

const PAGE_SIZE = 24

// Filters live in the URL so a filtered view can be bookmarked or shared, and
// survives navigating to a challenge and back.
export function ChallengesPage() {
  const { role } = useRole()
  const [params, setParams] = useSearchParams()
  const category = params.get('category') ?? ''
  const difficulty = params.get('difficulty') ?? ''
  const status = params.get('status') ?? ''
  const search = params.get('q') ?? ''

  // Filtering and search run on the server; pages are appended as the user
  // scrolls (infinite scroll), so the page stays light as the catalogue grows.
  const { items, firstPage, isStale, hasMore, loading, error, loadMore, retry } = useInfiniteApi<
    ChallengeSummary,
    ChallengeList
  >(
    `/challenges${toQuery({
      category,
      difficulty,
      status: role === 'support' ? status : undefined,
      q: search,
    })}`,
    PAGE_SIZE,
  )
  const total = firstPage?.total ?? 0
  const facets = firstPage?.facets

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
        <SearchInput
          value={search}
          onChange={(v) => setParam('q', v)}
          placeholder="Search by title, ID, or tag"
          label="Search challenges"
        />
        <select
          className="input"
          aria-label="Category"
          value={category}
          onChange={(e) => setParam('category', e.target.value)}
        >
          <option value="">All categories</option>
          {facets?.categories.map((c) => (
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
          {facets?.difficulties.map((d) => (
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
            {facets?.statuses.map((s) => (
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

      {error && items.length === 0 ? (
        <ErrorMessage error={error} onRetry={retry} />
      ) : !firstPage ? (
        <Loading label="Loading challenges…" />
      ) : (
        <div className={isStale ? 'refreshing' : undefined}>
          <p className="muted result-count" aria-live="polite">
            {isStale
              ? 'Updating…'
              : `Showing ${items.length} of ${total} ${total === 1 ? 'challenge' : 'challenges'}`}
          </p>
          {items.length === 0 ? (
            <div className="empty">No challenges match these filters.</div>
          ) : (
            <ul className="challenge-grid">
              {items.map((c) => (
                <li key={c.id}>
                  <ChallengeCard challenge={c} showStatus={role === 'support'} />
                </li>
              ))}
            </ul>
          )}
          {!isStale && (
            <InfiniteScrollFooter
              hasMore={hasMore}
              loading={loading}
              error={error}
              shown={items.length}
              onLoadMore={loadMore}
              onRetry={retry}
            />
          )}
        </div>
      )}
    </>
  )
}

// Loads the next page when the footer scrolls near the viewport. The button is
// the keyboard/no-IntersectionObserver fallback and doubles as a status line.
function InfiniteScrollFooter({
  hasMore,
  loading,
  error,
  shown,
  onLoadMore,
  onRetry,
}: {
  hasMore: boolean
  loading: boolean
  error: Error | null
  shown: number
  onLoadMore: () => void
  onRetry: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const canAutoLoad = hasMore && !loading && !error

  // Re-created after each page loads, so if the footer is still on screen
  // (tall window, short page) the next page is requested straight away.
  useEffect(() => {
    const el = ref.current
    if (!el || !canAutoLoad || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore()
      },
      { rootMargin: '400px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [canAutoLoad, onLoadMore])

  if (shown === 0) return null

  return (
    <div ref={ref} className="scroll-footer">
      {error ? (
        <ErrorMessage error={error} onRetry={onRetry} />
      ) : loading ? (
        <p className="muted" role="status">
          Loading more…
        </p>
      ) : hasMore ? (
        <button type="button" className="button" onClick={onLoadMore}>
          Load more
        </button>
      ) : (
        <p className="muted">You’ve reached the end.</p>
      )}
    </div>
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

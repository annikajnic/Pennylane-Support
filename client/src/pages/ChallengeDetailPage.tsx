import { Link, useLocation, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import type { ChallengeDetail } from '../api/types'
import { DifficultyBadge, StatusBadge, Tag } from '../components/Badges'
import { Markdown } from '../components/Markdown'
import { ErrorMessage, Loading } from '../components/Status'
import { useApi } from '../hooks/useApi'
import { formatDate, formatMinutes, formatPercent } from '../lib/format'
import { useRole } from '../role'

export function ChallengeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const { role } = useRole()
  const { data: c, error, reload } = useApi<ChallengeDetail>(`/challenges/${id}`)

  // Return to the filtered list the user came from, if any.
  const from = (location.state as { from?: string } | null)?.from ?? ''
  const backLink = (
    <Link to={`/challenges${from}`} className="back-link">
      ← All challenges
    </Link>
  )

  if (error) {
    return (
      <>
        {backLink}
        {error instanceof ApiError && error.status === 404 ? (
          <div className="empty">This challenge doesn’t exist or isn’t available.</div>
        ) : (
          <ErrorMessage error={error} onRetry={reload} />
        )}
      </>
    )
  }
  // Also guards against briefly showing the previous challenge when following a prerequisite link.
  if (!c || c.id !== id) return <Loading label="Loading challenge…" />

  return (
    <>
      {backLink}

      <article className="challenge-detail">
        <header className="detail-header">
          <div className="card-top">
            <span className="challenge-id">{c.id}</span>
            <DifficultyBadge difficulty={c.difficulty} />
            {role === 'support' && <StatusBadge status={c.status} />}
            <span className="challenge-category">{c.category}</span>
          </div>
          <h1>{c.title}</h1>
          <div className="tags">
            {c.tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        </header>

        <dl className="stat-row">
          <Stat label="Points" value={c.points} />
          <Stat label="Estimated time" value={formatMinutes(c.estimatedMinutes)} />
          <Stat label="Completion rate" value={formatPercent(c.completionRate)} />
          <Stat label="Avg. attempts to pass" value={c.averageAttemptsToPass.toFixed(1)} />
          <Stat label="Attempts" value={c.attemptCount.toLocaleString()} />
        </dl>

        <div className="detail-layout">
          <div className="detail-main">
            <section className="card">
              <Markdown>{c.description}</Markdown>
            </section>

            {c.learningObjectives.length > 0 && (
              <section className="card">
                <h2>Learning objectives</h2>
                <ul>
                  {c.learningObjectives.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              </section>
            )}

            {c.hints.length > 0 && (
              <section className="card">
                <h2>Hints</h2>
                <p className="muted">Stuck? Reveal one at a time.</p>
                {c.hints.map((h, i) => (
                  <details key={h} className="hint">
                    <summary>Hint {i + 1}</summary>
                    <p>{h}</p>
                  </details>
                ))}
              </section>
            )}
          </div>

          <aside className="detail-side">
            <section className="card card-pink">
              <h2>Need help?</h2>
              <p>
                {c.conversationCount === 0
                  ? 'No one has asked about this challenge yet.'
                  : `${c.conversationCount} ${c.conversationCount === 1 ? 'conversation' : 'conversations'} about this challenge.`}
              </p>
              <Link to={`/conversations?challengeId=${c.id}`} className="button">
                View conversations
              </Link>
            </section>

            <section className="card">
              <h2>Prerequisites</h2>
              {c.prerequisites.length === 0 ? (
                <p className="muted">None, so you can start here.</p>
              ) : (
                <ul className="prereq-list">
                  {c.prerequisites.map((p) => (
                    <li key={p.id}>
                      <Link to={`/challenges/${p.id}`} state={{ from }}>
                        {p.title}
                      </Link>{' '}
                      <span className="muted">({p.id})</span>
                      {role === 'support' && p.status !== 'published' && (
                        <> <StatusBadge status={p.status} /></>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <h2>Details</h2>
              <dl className="meta-list">
                <dt>Author</dt>
                <dd>{c.author}</dd>
                <dt>Created</dt>
                <dd>{formatDate(c.createdAt)}</dd>
                <dt>Updated</dt>
                <dd>{formatDate(c.updatedAt)}</dd>
              </dl>
            </section>
          </aside>
        </div>
      </article>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

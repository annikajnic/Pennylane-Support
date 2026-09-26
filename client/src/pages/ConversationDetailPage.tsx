import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, apiFetch } from '../api/client'
import type {
  ConversationDetail,
  ConversationList,
  ConversationStatus,
  ConversationUpdate,
  Post,
  Priority,
} from '../api/types'
import {
  Avatar,
  ConversationStatusBadge,
  PriorityBadge,
  RoleBadge,
  Tag,
} from '../components/Badges'
import { Markdown } from '../components/Markdown'
import { ErrorMessage, Loading } from '../components/Status'
import { useApi } from '../hooks/useApi'
import { useDisplayName } from '../hooks/useDisplayName'
import { capitalize, formatDateTime, formatHours, formatRelative } from '../lib/format'
import { useRole } from '../role'

const STATUSES: ConversationStatus[] = ['open', 'answered', 'resolved', 'closed']
const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent']

export function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { role } = useRole()
  const isSupport = role === 'support'
  const { data: c, error, reload } = useApi<ConversationDetail>(`/conversations/${id}`)

  const backLink = (
    <Link to="/conversations" className="back-link">
      ← All conversations
    </Link>
  )

  if (error) {
    return (
      <>
        {backLink}
        {error instanceof ApiError && error.status === 404 ? (
          <div className="empty">This conversation doesn’t exist or isn’t available.</div>
        ) : (
          <ErrorMessage error={error} onRetry={reload} />
        )}
      </>
    )
  }
  if (!c || c.id !== id) return <Loading label="Loading conversation…" />

  return (
    <>
      {backLink}

      <header className="detail-header">
        <div className="card-top">
          <span className="challenge-id">{c.id}</span>
          <ConversationStatusBadge status={c.status} />
          {isSupport && <PriorityBadge priority={c.priority} />}
          {c.isPinned && <span title="Pinned">📌</span>}
          {c.isLocked && <span title="Locked">🔒 Locked</span>}
          <span className="challenge-category">{c.category}</span>
        </div>
        <h1>{c.topic}</h1>
        <div className="tags">
          {c.tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>
      </header>

      <div className="detail-layout">
        <div className="detail-main">
          {isSupport && c.description && (
            <details className="card brief">
              <summary>Conversation brief</summary>
              <Markdown>{c.description}</Markdown>
            </details>
          )}

          <ol className="post-list" aria-label="Posts">
            {c.posts.map((p) => (
              <li key={p.id}>
                <PostCard post={p} isOriginal={p.postNumber === 1} />
              </li>
            ))}
          </ol>

          {c.isLocked && !isSupport ? (
            <div className="empty">🔒 This conversation is locked, so no new replies can be added.</div>
          ) : (
            <ReplyForm conversationId={c.id} locked={c.isLocked} onPosted={reload} />
          )}
        </div>

        <aside className="detail-side">
          <section className="card card-blue">
            <h2>Challenge</h2>
            {/* Learners can only see conversations on published challenges, so the link is always valid for them. */}
            <Link to={`/challenges/${c.challenge.id}`} className="challenge-link">
              {c.challenge.title}
            </Link>{' '}
            <span className="challenge-id">{c.challenge.id}</span>
          </section>

          {isSupport && <SupportControls conversation={c} onUpdated={reload} />}

          <section className="card">
            <h2>Participants ({c.participants.length})</h2>
            <ul className="participant-list">
              {c.participants.map((p) => (
                <li key={p.user}>
                  <Avatar user={p.user} role={p.role} />
                  <span className="participant-name">{p.user}</span>
                  <RoleBadge role={p.role} />
                  <span className="muted">
                    {p.postCount} {p.postCount === 1 ? 'post' : 'posts'}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2>Details</h2>
            <dl className="meta-list">
              <dt>Started</dt>
              <dd>{formatDateTime(c.createdAt)}</dd>
              <dt>Last activity</dt>
              <dd>{formatRelative(c.lastActivityAt)}</dd>
              <dt>Views</dt>
              <dd>{c.viewCount.toLocaleString()}</dd>
              {c.resolutionTimeHours !== null && (
                <>
                  <dt>Resolved in</dt>
                  <dd>{formatHours(c.resolutionTimeHours)}</dd>
                </>
              )}
            </dl>
          </section>
        </aside>
      </div>
    </>
  )
}

function PostCard({ post: p, isOriginal }: { post: Post; isOriginal: boolean }) {
  return (
    <article
      className={`card post ${p.isAcceptedAnswer ? 'post-accepted' : ''} post-${p.userRole}`}
      aria-label={`Post ${p.postNumber} by ${p.user}`}
    >
      <header className="post-header">
        <Avatar user={p.user} role={p.userRole} />
        <span className="participant-name">{p.user}</span>
        <RoleBadge role={p.userRole} />
        {isOriginal && <span className="muted">asked</span>}
        <time
          className="muted post-time"
          dateTime={p.timestamp}
          title={formatDateTime(p.timestamp)}
        >
          {formatRelative(p.timestamp)}
        </time>
      </header>
      {p.isAcceptedAnswer && <div className="accepted-flag">✓ Accepted answer</div>}
      <Markdown>{p.content}</Markdown>
      {(p.upvotes > 0 || p.helpful > 0) && (
        <footer className="post-reactions muted">
          <span title="Upvotes">▲ {p.upvotes}</span>
          <span title="Marked helpful">💡 {p.helpful} helpful</span>
        </footer>
      )}
    </article>
  )
}

function ReplyForm({
  conversationId,
  locked,
  onPosted,
}: {
  conversationId: string
  locked: boolean
  onPosted: () => void
}) {
  const { role } = useRole()
  const [name, setName] = useDisplayName()
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await apiFetch(`/conversations/${conversationId}/messages`, role, {
        method: 'POST',
        body: JSON.stringify({ user: name, content }),
      })
      setContent('')
      onPosted()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card reply-form" onSubmit={handleSubmit}>
      <h2>{role === 'support' ? 'Reply as support' : 'Add a reply'}</h2>
      {locked && (
        <p className="muted">This conversation is locked for learners; support can still reply.</p>
      )}
      <label className="field">
        <span>Your name</span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={50}
          placeholder={role === 'support' ? 'e.g. pennylane_support' : 'e.g. quantum_learner42'}
        />
      </label>
      <label className="field">
        <span>Message</span>
        <textarea
          className="input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          maxLength={10000}
          rows={5}
          placeholder="Markdown is supported, including ```code blocks```."
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div>
        <button
          type="submit"
          className="button button-primary"
          disabled={submitting || !name.trim() || !content.trim()}
        >
          {submitting ? 'Posting…' : 'Post reply'}
        </button>
      </div>
    </form>
  )
}

// Each control saves as soon as it changes; the page then reloads so the
// badges, resolution time, etc. reflect what the server stored. Until that
// fresh data arrives, the chosen values are shown optimistically.
function SupportControls({
  conversation,
  onUpdated,
}: {
  conversation: ConversationDetail
  onUpdated: () => void
}) {
  const { role } = useRole()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<ConversationUpdate>({})
  const [lastConversation, setLastConversation] = useState(conversation)

  // Fresh server data supersedes any optimistic values.
  if (conversation !== lastConversation) {
    setLastConversation(conversation)
    setPending({})
  }
  const c = { ...conversation, ...pending }
  // Assignee options come from the list endpoint's facets.
  const { data: list } = useApi<ConversationList>('/conversations?pageSize=1')
  const assignees = [...new Set([...(list?.facets.assignees ?? []), ...(c.assignedTo ? [c.assignedTo] : [])])].sort()

  async function update(change: ConversationUpdate) {
    setSaving(true)
    setError(null)
    setPending((p) => ({ ...p, ...change }))
    try {
      await apiFetch(`/conversations/${c.id}`, role, {
        method: 'PATCH',
        body: JSON.stringify(change),
      })
      onUpdated()
    } catch (err) {
      setPending({})
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card card-yellow support-controls" aria-busy={saving}>
      <h2>Triage</h2>
      <label className="field">
        <span>Status</span>
        <select
          className="input"
          value={c.status}
          disabled={saving}
          onChange={(e) => update({ status: e.target.value as ConversationStatus })}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {capitalize(s)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Assigned to</span>
        <select
          className="input"
          value={c.assignedTo ?? ''}
          disabled={saving}
          onChange={(e) => update({ assignedTo: e.target.value || null })}
        >
          <option value="">Unassigned</option>
          {assignees.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Priority</span>
        <select
          className="input"
          value={c.priority}
          disabled={saving}
          onChange={(e) => update({ priority: e.target.value as Priority })}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {capitalize(p)}
            </option>
          ))}
        </select>
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={c.isPinned}
          disabled={saving}
          onChange={(e) => update({ isPinned: e.target.checked })}
        />
        Pinned
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={c.isLocked}
          disabled={saving}
          onChange={(e) => update({ isLocked: e.target.checked })}
        />
        Locked (learners can’t reply)
      </label>
      <p className="save-state muted" aria-live="polite">
        {saving ? 'Saving…' : error ? '' : 'Changes save automatically.'}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../api/client'
import type { ChallengeList } from '../api/types'
import { ErrorMessage, Loading } from '../components/Status'
import { useApi } from '../hooks/useApi'
import { useDisplayName } from '../hooks/useDisplayName'
import { useRole } from '../role'

const MAX_TAGS = 5
// The picker lists every challenge in one request (the API's maximum page size).
const CHALLENGE_PICKER_LIMIT = 200

export function NewConversationPage() {
  const { role } = useRole()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data: challenges, error: loadError, reload } = useApi<ChallengeList>(`/challenges?pageSize=${CHALLENGE_PICKER_LIMIT}`)

  const [challengeId, setChallengeId] = useState(params.get('challengeId') ?? '')
  const [topic, setTopic] = useState('')
  const [content, setContent] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [name, setName] = useDisplayName()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tags = tagInput
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const { id } = await apiFetch<{ id: string }>('/conversations', role, {
        method: 'POST',
        body: JSON.stringify({ challengeId, topic, content, user: name, tags }),
      })
      navigate(`/conversations/${id}`)
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  if (loadError) return <ErrorMessage error={loadError} onRetry={reload} />
  if (!challenges) return <Loading label="Loading challenges…" />

  const canSubmit =
    challengeId && topic.trim() && content.trim() && name.trim() && tags.length <= MAX_TAGS

  return (
    <>
      <Link to="/conversations" className="back-link">
        ← All conversations
      </Link>
      <div className="page-header">
        <h1>New conversation</h1>
        <p className="muted">Ask the community and the support team about a challenge.</p>
      </div>

      <form className="card new-conversation-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Challenge</span>
          <select
            className="input"
            value={challengeId}
            onChange={(e) => setChallengeId(e.target.value)}
            required
          >
            <option value="">Choose a challenge…</option>
            {challenges.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} · {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Topic</span>
          <input
            className="input"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
            maxLength={200}
            placeholder="e.g. VQE cost function not converging"
          />
        </label>
        <label className="field">
          <span>Describe the problem</span>
          <textarea
            className="input"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            maxLength={10000}
            rows={8}
            placeholder="What did you try, what happened, and what did you expect? Markdown and ```code blocks``` are supported."
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Your name</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={50}
            />
          </label>
          <label className="field">
            <span>
              Tags <span className="muted">(optional, comma-separated, up to {MAX_TAGS})</span>
            </span>
            <input
              className="input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="vqe, optimization"
              aria-invalid={tags.length > MAX_TAGS}
            />
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div>
          <button type="submit" className="button button-primary" disabled={submitting || !canSubmit}>
            {submitting ? 'Posting…' : 'Start conversation'}
          </button>
        </div>
      </form>
    </>
  )
}

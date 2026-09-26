const DIFFICULTY_CLASS: Record<string, string> = {
  Beginner: 'badge-blue',
  Intermediate: 'badge-yellow',
  Advanced: 'badge-pink',
  Expert: 'badge-ink',
}

export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  return <span className={`badge ${DIFFICULTY_CLASS[difficulty] ?? ''}`}>{difficulty}</span>
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-status-${status}`}>{status}</span>
}

export function Tag({ children }: { children: string }) {
  return <span className="tag">#{children}</span>
}

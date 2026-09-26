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

const CONVERSATION_STATUS_CLASS: Record<string, string> = {
  open: 'badge-pink',
  answered: 'badge-yellow',
  resolved: 'badge-blue',
  closed: 'badge-muted',
}

export function ConversationStatusBadge({ status }: { status: string }) {
  return <span className={`badge ${CONVERSATION_STATUS_CLASS[status] ?? ''}`}>{status}</span>
}

export function PriorityBadge({ priority }: { priority: string }) {
  return <span className={`priority priority-${priority}`}>{priority}</span>
}

const ROLE_CLASS: Record<string, string> = {
  learner: 'role-learner',
  mentor: 'role-mentor',
  support: 'role-support',
  staff: 'role-staff',
}

export function RoleBadge({ role }: { role: string }) {
  return <span className={`badge role-badge ${ROLE_CLASS[role] ?? ''}`}>{role}</span>
}

export function Avatar({ user, role }: { user: string; role: string }) {
  return (
    <span className={`avatar ${ROLE_CLASS[role] ?? ''}`} aria-hidden="true">
      {user.charAt(0).toUpperCase()}
    </span>
  )
}

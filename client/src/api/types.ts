// Response shapes from the Express API (see server/src/routes).

export interface ChallengeSummary {
  id: string
  title: string
  description: string
  category: string
  difficulty: string
  points: number
  status: string
  estimatedMinutes: number
  completionRate: number
  tags: string[]
  conversationCount: number
}

export interface ChallengeList {
  items: ChallengeSummary[]
  total: number
  facets: {
    categories: string[]
    difficulties: string[]
    statuses: string[]
  }
}

export interface ChallengeDetail extends ChallengeSummary {
  attemptCount: number
  averageAttemptsToPass: number
  author: string
  createdAt: string
  updatedAt: string
  learningObjectives: string[]
  hints: string[]
  prerequisites: { id: string; title: string; difficulty: string; status: string }[]
}

export type ConversationStatus = 'open' | 'answered' | 'resolved' | 'closed'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export interface ConversationSummary {
  id: string
  topic: string
  category: string
  status: ConversationStatus
  priority: Priority
  challenge: { id: string; title: string; status: string }
  createdAt: string
  updatedAt: string
  lastActivityAt: string
  viewCount: number
  isPinned: boolean
  isLocked: boolean
  assignedTo: string | null
  resolutionTimeHours: number | null
  tags: string[]
  postCount: number
  participantCount: number
  hasAcceptedAnswer: boolean
}

export interface ConversationList {
  items: ConversationSummary[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  facets: {
    statuses: ConversationStatus[]
    priorities: Priority[]
    categories: string[]
    assignees: string[]
  }
}

export interface Post {
  id: number
  postNumber: number
  user: string
  userRole: string
  content: string
  timestamp: string
  upvotes: number
  helpful: number
  isAcceptedAnswer: boolean
}

export interface ConversationDetail extends ConversationSummary {
  description: string | null
  participants: { user: string; role: string; postCount: number }[]
  posts: Post[]
}

export type ConversationUpdate = Partial<{
  status: ConversationStatus
  priority: Priority
  assignedTo: string | null
  isPinned: boolean
  isLocked: boolean
}>

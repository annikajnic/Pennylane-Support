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

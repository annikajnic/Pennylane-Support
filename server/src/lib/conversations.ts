import { Prisma, type Conversation, type Post } from "@prisma/client";
import { parseJsonArray } from "./json.js";

export const CONVERSATION_STATUSES = ["open", "answered", "resolved", "closed"] as const;
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

// Statuses that count as "done": these carry a resolution time, the others don't.
export const RESOLVED_STATUSES: readonly string[] = ["resolved", "closed"];

// Forum category for conversations started from a challenge page.
export const DEFAULT_CATEGORY = "PennyLane Challenges";

export function toPostDto(p: Post) {
  return {
    id: p.id,
    postNumber: p.postNumber,
    user: p.user,
    userRole: p.userRole,
    content: p.content,
    timestamp: p.timestamp,
    upvotes: p.upvotes,
    helpful: p.helpful,
    isAcceptedAnswer: p.isAcceptedAnswer,
  };
}

export function toConversationSummary(
  c: Conversation & {
    challenge: { id: string; title: string; status: string };
    _count: { posts: number };
  },
  participantCount: number,
  hasAcceptedAnswer: boolean,
) {
  return {
    id: c.id,
    topic: c.topic,
    category: c.category,
    status: c.status,
    priority: c.priority,
    challenge: c.challenge,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    lastActivityAt: c.lastActivityAt,
    viewCount: c.viewCount,
    isPinned: c.isPinned,
    isLocked: c.isLocked,
    assignedTo: c.assignedTo,
    resolutionTimeHours: c.resolutionTimeHours,
    tags: parseJsonArray(c.tags),
    postCount: c._count.posts,
    participantCount,
    hasAcceptedAnswer,
  };
}

// Participants are derived from posts rather than stored (see README):
// one entry per distinct user, in order of first appearance.
export function deriveParticipants(posts: Post[]) {
  const byUser = new Map<string, { user: string; role: string; postCount: number }>();
  for (const p of posts) {
    const existing = byUser.get(p.user);
    if (existing) existing.postCount += 1;
    else byUser.set(p.user, { user: p.user, role: p.userRole, postCount: 1 });
  }
  return [...byUser.values()];
}

// IDs follow the source format (CONV_0001). The numeric max is taken in SQL
// because string ordering would break once IDs pass CONV_9999.
export async function nextConversationId(tx: Prisma.TransactionClient): Promise<string> {
  const [row] = await tx.$queryRaw<{ maxId: number | bigint | null }[]>`
    SELECT MAX(CAST(SUBSTR(id, 6) AS INTEGER)) AS maxId
    FROM Conversation
    WHERE id LIKE 'CONV_%'
  `;
  const next = Number(row?.maxId ?? 0) + 1;
  return `CONV_${String(next).padStart(4, "0")}`;
}

// Two concurrent writers can compute the same next ID / post number; the
// unique constraint rejects the loser, which then simply retries.
export async function withUniqueRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const isUniqueViolation =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!isUniqueViolation || i >= attempts) throw err;
    }
  }
}

export function hoursBetween(from: Date, to: Date): number {
  return Math.round(((to.getTime() - from.getTime()) / 3_600_000) * 10) / 10;
}

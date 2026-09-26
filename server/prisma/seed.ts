import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// The raw data files live at the repo root, one level above /server.
const DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

interface RawChallenge {
  challenge_id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  points: number | string;
  tags: string[];
  learning_objectives: string[];
  hints: string[];
  status: string;
  estimated_minutes: number;
  completion_rate: number;
  attempt_count: number;
  average_attempts_to_pass: number;
  created_at: string;
  updated_at: string;
  author: string;
  prerequisite_challenge_ids: string[];
}

interface RawPost {
  post_id: number;
  user: string;
  timestamp: string;
  content: string;
  user_role: string;
  reactions: { upvotes: number; helpful: number };
  is_accepted_answer: boolean;
}

interface RawConversation {
  identifier: string;
  topic: string;
  category: string;
  description?: string;
  challenge_id: string;
  status: string;
  priority: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  // participant_count / participants are ignored — derived from posts instead.
  participant_count: number;
  participants: string[];
  view_count: number;
  is_pinned: boolean;
  is_locked: boolean;
  assigned_to: string | null;
  resolution_time_hours: number | null;
  posts: RawPost[];
}

// The source data isn't perfectly typed (e.g. one challenge has points: "225"),
// so numeric fields are coerced and validated rather than trusted.
function toNumber(value: unknown, field: string): number {
  const n = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new Error(`Invalid number for ${field}: ${JSON.stringify(value)}`);
  }
  return n;
}

function toDate(value: string, field: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date for ${field}: ${value}`);
  return d;
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(DATA_DIR, file), "utf8")) as T;
}

async function main() {
  const { coding_challenges: challenges } = readJson<{ coding_challenges: RawChallenge[] }>(
    "pennylane_coding_challenges.json",
  );
  const { support_conversations: conversations } = readJson<{
    support_conversations: RawConversation[];
  }>("pennylane_support_conversations.json");

  // Children first so FK constraints are satisfied; makes the seed re-runnable.
  await prisma.post.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.challenge.deleteMany();

  await prisma.challenge.createMany({
    data: challenges.map((c) => ({
      id: c.challenge_id,
      title: c.title,
      description: c.description,
      category: c.category,
      difficulty: c.difficulty,
      points: toNumber(c.points, `${c.challenge_id}.points`),
      status: c.status,
      estimatedMinutes: toNumber(c.estimated_minutes, `${c.challenge_id}.estimated_minutes`),
      completionRate: toNumber(c.completion_rate, `${c.challenge_id}.completion_rate`),
      attemptCount: toNumber(c.attempt_count, `${c.challenge_id}.attempt_count`),
      averageAttemptsToPass: toNumber(c.average_attempts_to_pass, `${c.challenge_id}.average_attempts_to_pass`),
      author: c.author,
      createdAt: toDate(c.created_at, "created_at"),
      updatedAt: toDate(c.updated_at, "updated_at"),
      tags: JSON.stringify(c.tags),
      learningObjectives: JSON.stringify(c.learning_objectives),
      hints: JSON.stringify(c.hints),
      prerequisiteIds: JSON.stringify(c.prerequisite_challenge_ids),
    })),
  });

  await prisma.conversation.createMany({
    data: conversations.map((c) => ({
      id: c.identifier,
      topic: c.topic,
      category: c.category,
      description: c.description ?? null,
      status: c.status,
      priority: c.priority,
      challengeId: c.challenge_id,
      createdAt: toDate(c.created_at, "created_at"),
      updatedAt: toDate(c.updated_at, "updated_at"),
      lastActivityAt: toDate(c.last_activity_at, "last_activity_at"),
      viewCount: toNumber(c.view_count, `${c.identifier}.view_count`),
      isPinned: c.is_pinned,
      isLocked: c.is_locked,
      assignedTo: c.assigned_to,
      resolutionTimeHours: c.resolution_time_hours,
      tags: JSON.stringify(c.tags),
    })),
  });

  await prisma.post.createMany({
    data: conversations.flatMap((c) =>
      c.posts.map((p) => ({
        postNumber: p.post_id,
        conversationId: c.identifier,
        user: p.user,
        userRole: p.user_role,
        content: p.content,
        timestamp: toDate(p.timestamp, "timestamp"),
        upvotes: p.reactions.upvotes,
        helpful: p.reactions.helpful,
        isAcceptedAnswer: p.is_accepted_answer,
      })),
    ),
  });

  // Sanity check: derived participant counts should match the raw data we dropped.
  const derived = await prisma.post.groupBy({ by: ["conversationId", "user"] });
  const derivedCounts = new Map<string, number>();
  for (const row of derived) {
    derivedCounts.set(row.conversationId, (derivedCounts.get(row.conversationId) ?? 0) + 1);
  }
  const mismatches = conversations.filter(
    (c) => derivedCounts.get(c.identifier) !== c.participant_count,
  );

  const [challengeCount, conversationCount, postCount] = await Promise.all([
    prisma.challenge.count(),
    prisma.conversation.count(),
    prisma.post.count(),
  ]);
  console.log(
    `Seeded ${challengeCount} challenges, ${conversationCount} conversations, ${postCount} posts.`,
  );
  if (mismatches.length > 0) {
    console.warn(
      `Warning: ${mismatches.length} conversations have a derived participant count that differs from the source data.`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

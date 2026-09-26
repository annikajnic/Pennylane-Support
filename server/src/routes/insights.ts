import { Router } from "express";
import { prisma } from "../db.js";
import {
  CONVERSATION_STATUSES,
  PRIORITIES,
  RESOLVED_STATUSES,
  UNRESOLVED_STATUSES,
} from "../lib/conversations.js";
import { HttpError, asyncHandler } from "../lib/http.js";
import { getRole } from "../lib/role.js";

export const insightsRouter = Router();

const TOP_CHALLENGES_LIMIT = 10;

function round1(n: number | null): number | null {
  return n === null ? null : Math.round(n * 10) / 10;
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// GET /insights — support-only dashboard numbers across all conversations.
insightsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (getRole(req) !== "support") {
      throw new HttpError(403, "Insights are only available to the support team");
    }

    const [byStatusRows, resolutionTimes, byPriorityRows, topChallengeRows, workloadRows] =
      await Promise.all([
        prisma.conversation.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.conversation.findMany({
          where: { resolutionTimeHours: { not: null } },
          select: { resolutionTimeHours: true },
          orderBy: { resolutionTimeHours: "asc" },
        }),
        prisma.conversation.groupBy({
          by: ["priority"],
          where: { resolutionTimeHours: { not: null } },
          _avg: { resolutionTimeHours: true },
          _count: { _all: true },
        }),
        prisma.conversation.groupBy({
          by: ["challengeId"],
          _count: { _all: true },
          orderBy: [{ _count: { challengeId: "desc" } }, { challengeId: "asc" }],
          take: TOP_CHALLENGES_LIMIT,
        }),
        prisma.conversation.groupBy({
          by: ["assignedTo"],
          where: { status: { in: UNRESOLVED_STATUSES } },
          _count: { _all: true },
        }),
      ]);

    // --- Status counts ("open vs resolved") ---
    const byStatus = Object.fromEntries(CONVERSATION_STATUSES.map((s) => [s, 0])) as Record<
      string,
      number
    >;
    for (const row of byStatusRows) byStatus[row.status] = row._count._all;
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const resolved = RESOLVED_STATUSES.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0);

    // --- Resolution time ---
    const hours = resolutionTimes.map((r) => r.resolutionTimeHours as number);
    const averageHours = hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null;
    const byPriority = PRIORITIES.map((priority) => {
      const row = byPriorityRows.find((r) => r.priority === priority);
      return {
        priority,
        averageHours: round1(row?._avg.resolutionTimeHours ?? null),
        resolvedCount: row?._count._all ?? 0,
      };
    });

    // --- Most-asked-about challenges, with how many are still unresolved ---
    const topIds = topChallengeRows.map((r) => r.challengeId);
    const [challenges, unresolvedRows] = await Promise.all([
      prisma.challenge.findMany({
        where: { id: { in: topIds } },
        select: { id: true, title: true, status: true },
      }),
      prisma.conversation.groupBy({
        by: ["challengeId"],
        where: { challengeId: { in: topIds }, status: { in: UNRESOLVED_STATUSES } },
        _count: { _all: true },
      }),
    ]);
    const topChallenges = topChallengeRows.map((row) => {
      const challenge = challenges.find((c) => c.id === row.challengeId);
      return {
        id: row.challengeId,
        title: challenge?.title ?? row.challengeId,
        status: challenge?.status ?? "unknown",
        conversationCount: row._count._all,
        unresolvedCount:
          unresolvedRows.find((u) => u.challengeId === row.challengeId)?._count._all ?? 0,
      };
    });

    // --- Unresolved workload per assignee (null = unassigned) ---
    const workload = workloadRows
      .map((r) => ({ assignee: r.assignedTo, unresolvedCount: r._count._all }))
      .sort(
        (a, b) =>
          b.unresolvedCount - a.unresolvedCount || (a.assignee ?? "").localeCompare(b.assignee ?? ""),
      );

    res.json({
      conversations: {
        total,
        byStatus,
        unresolved: total - resolved,
        resolved,
        unresolvedStatuses: UNRESOLVED_STATUSES,
        resolvedStatuses: RESOLVED_STATUSES,
      },
      resolution: {
        averageHours: round1(averageHours),
        medianHours: round1(median(hours)),
        resolvedCount: hours.length,
        byPriority,
      },
      topChallenges,
      workload,
    });
  }),
);

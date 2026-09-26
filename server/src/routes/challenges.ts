import { Router } from "express";
import type { Challenge, Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { HttpError, asyncHandler, matchStoredValue, queryString } from "../lib/http.js";
import { parseJsonArray } from "../lib/json.js";
import { LEARNER_VISIBLE_CHALLENGE_STATUS, getRole } from "../lib/role.js";

export const challengesRouter = Router();

const DIFFICULTY_ORDER = ["Beginner", "Intermediate", "Advanced", "Expert"];

// Known levels in ascending order; anything unexpected sorts to the end.
function byDifficulty(a: string, b: string) {
  const rank = (d: string) => {
    const i = DIFFICULTY_ORDER.indexOf(d);
    return i === -1 ? DIFFICULTY_ORDER.length : i;
  };
  return rank(a) - rank(b);
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort();
}

// List view omits the long-form fields (hints, learning objectives) to keep the
// payload small; the detail endpoint returns everything.
function toSummary(c: Challenge & { _count: { conversations: number } }) {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    category: c.category,
    difficulty: c.difficulty,
    points: c.points,
    status: c.status,
    estimatedMinutes: c.estimatedMinutes,
    completionRate: c.completionRate,
    tags: parseJsonArray(c.tags),
    conversationCount: c._count.conversations,
  };
}

challengesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const isSupport = getRole(req) === "support";

    // Distinct values are tiny (a dozen categories, four difficulties), so
    // looking them up per request is cheap. Scoped to what this viewer can see,
    // so they double as the filter options returned in `facets`.
    const stored = await prisma.challenge.findMany({
      where: isSupport ? {} : { status: LEARNER_VISIBLE_CHALLENGE_STATUS },
      select: { category: true, difficulty: true, status: true },
      distinct: ["category", "difficulty", "status"],
    });
    const facets = {
      categories: uniqueSorted(stored.map((c) => c.category)),
      difficulties: uniqueSorted(stored.map((c) => c.difficulty)).sort(byDifficulty),
      statuses: isSupport ? uniqueSorted(stored.map((c) => c.status)) : [],
    };

    const category = matchStoredValue(queryString(req.query.category), facets.categories);
    const difficulty = matchStoredValue(queryString(req.query.difficulty), facets.difficulties);
    // Learners only ever see published challenges; the status filter is support-only.
    const status = isSupport
      ? matchStoredValue(queryString(req.query.status), facets.statuses)
      : LEARNER_VISIBLE_CHALLENGE_STATUS;

    const where: Prisma.ChallengeWhereInput = {
      ...(category && { category }),
      ...(difficulty && { difficulty }),
      ...(status && { status }),
    };

    const challenges = await prisma.challenge.findMany({
      where,
      orderBy: { id: "asc" },
      include: { _count: { select: { conversations: true } } },
    });

    res.json({ items: challenges.map(toSummary), total: challenges.length, facets });
  }),
);

challengesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const isSupport = getRole(req) === "support";
    const challenge = await prisma.challenge.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { conversations: true } } },
    });
    // Hidden challenges 404 for learners rather than 403, so their existence isn't leaked.
    if (!challenge || (!isSupport && challenge.status !== LEARNER_VISIBLE_CHALLENGE_STATUS)) {
      throw new HttpError(404, `Challenge ${req.params.id} not found`);
    }

    // Resolve prerequisite IDs to titles so the UI can link to them directly.
    // Some published challenges list draft/archived prerequisites; learners
    // don't see those, since the links would 404 for them.
    const prerequisiteIds = parseJsonArray(challenge.prerequisiteIds);
    const prerequisites = await prisma.challenge.findMany({
      where: {
        id: { in: prerequisiteIds },
        ...(!isSupport && { status: LEARNER_VISIBLE_CHALLENGE_STATUS }),
      },
      select: { id: true, title: true, difficulty: true, status: true },
      orderBy: { id: "asc" },
    });

    res.json({
      ...toSummary(challenge),
      attemptCount: challenge.attemptCount,
      averageAttemptsToPass: challenge.averageAttemptsToPass,
      author: challenge.author,
      createdAt: challenge.createdAt,
      updatedAt: challenge.updatedAt,
      learningObjectives: parseJsonArray(challenge.learningObjectives),
      hints: parseJsonArray(challenge.hints),
      prerequisites,
    });
  }),
);

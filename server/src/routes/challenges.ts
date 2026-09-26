import { Router } from "express";
import type { Challenge, Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { HttpError, asyncHandler, queryString } from "../lib/http.js";
import { parseJsonArray } from "../lib/json.js";

export const challengesRouter = Router();

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
    const category = queryString(req.query.category);
    const difficulty = queryString(req.query.difficulty);
    const status = queryString(req.query.status);

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

    res.json({ items: challenges.map(toSummary), total: challenges.length });
  }),
);

challengesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const challenge = await prisma.challenge.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { conversations: true } } },
    });
    if (!challenge) throw new HttpError(404, `Challenge ${req.params.id} not found`);

    // Resolve prerequisite IDs to titles so the UI can link to them directly.
    const prerequisiteIds = parseJsonArray(challenge.prerequisiteIds);
    const prerequisites = await prisma.challenge.findMany({
      where: { id: { in: prerequisiteIds } },
      select: { id: true, title: true, difficulty: true },
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

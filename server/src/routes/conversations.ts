import { Router, type Request } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import {
  CONVERSATION_STATUSES,
  DEFAULT_CATEGORY,
  PRIORITIES,
  RESOLVED_STATUSES,
  UNRESOLVED_STATUSES,
  deriveParticipants,
  hoursBetween,
  nextConversationId,
  toConversationSummary,
  toPostDto,
  withUniqueRetry,
} from "../lib/conversations.js";
import { HttpError, asyncHandler, matchStoredValue, parseBody, queryString } from "../lib/http.js";
import { LEARNER_VISIBLE_CHALLENGE_STATUS, getRole } from "../lib/role.js";

export const conversationsRouter = Router();

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
// Sentinel for ?assignedTo=unassigned, since "no assignee" can't be expressed as a value.
const UNASSIGNED = "unassigned";
const UNRESOLVED = "unresolved";

// Conversations about draft/archived challenges are support-only, consistent
// with hiding those challenges from learners (otherwise their titles leak).
function visibilityScope(req: Request): Prisma.ConversationWhereInput {
  return getRole(req) === "support"
    ? {}
    : { challenge: { status: LEARNER_VISIBLE_CHALLENGE_STATUS } };
}

// Loads a conversation the viewer is allowed to see, or 404s.
async function findVisibleConversation(req: Request, id: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id, ...visibilityScope(req) },
  });
  if (!conversation) throw new HttpError(404, `Conversation ${id} not found`);
  return conversation;
}

function positiveInt(value: unknown, fallback: number): number {
  const n = Number(queryString(value));
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

const displayName = z.string().trim().min(1, "is required").max(50);
const content = z.string().trim().min(1, "is required").max(10_000);

const createConversationSchema = z.object({
  challengeId: z.string().trim().min(1, "is required"),
  topic: z.string().trim().min(1, "is required").max(200),
  content,
  user: displayName,
  tags: z.array(z.string().trim().min(1).max(30)).max(5).default([]),
});

const createMessageSchema = z.object({
  content,
  user: displayName,
});

const updateConversationSchema = z
  .object({
    status: z.enum(CONVERSATION_STATUSES),
    priority: z.enum(PRIORITIES),
    // null unassigns.
    assignedTo: z.string().trim().min(1).max(50).nullable(),
    isPinned: z.boolean(),
    isLocked: z.boolean(),
  })
  .partial()
  .strict();

// ---------------------------------------------------------------------------
// GET /conversations — list with filters, pagination, and derived counts.
// ---------------------------------------------------------------------------
conversationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const scope = visibilityScope(req);

    // Filter options for the UI, scoped to what this viewer can see. They also
    // resolve case-insensitive filter input to stored values.
    const stored = await prisma.conversation.findMany({
      where: scope,
      select: { status: true, priority: true, category: true, assignedTo: true },
      distinct: ["status", "priority", "category", "assignedTo"],
    });
    const unique = (values: (string | null)[]) =>
      [...new Set(values.filter((v): v is string => v !== null))].sort();
    const facets = {
      statuses: CONVERSATION_STATUSES.filter((s) => stored.some((c) => c.status === s)),
      priorities: PRIORITIES.filter((p) => stored.some((c) => c.priority === p)),
      categories: unique(stored.map((c) => c.category)),
      assignees: unique(stored.map((c) => c.assignedTo)),
    };

    // "unresolved" is a group filter (open + answered), used by the triage
    // views and the insights workload links.
    const statusInput = queryString(req.query.status);
    const statusFilter: Prisma.ConversationWhereInput =
      statusInput?.toLowerCase() === UNRESOLVED
        ? { status: { in: UNRESOLVED_STATUSES } }
        : statusInput
          ? { status: matchStoredValue(statusInput, facets.statuses) }
          : {};
    const priority = matchStoredValue(queryString(req.query.priority), facets.priorities);
    const category = matchStoredValue(queryString(req.query.category), facets.categories);
    const assignedInput = queryString(req.query.assignedTo);
    const assignedTo =
      assignedInput?.toLowerCase() === UNASSIGNED
        ? null
        : matchStoredValue(assignedInput, facets.assignees);
    const challengeId = queryString(req.query.challengeId)?.toUpperCase();
    const search = queryString(req.query.q);

    const where: Prisma.ConversationWhereInput = {
      ...scope,
      ...statusFilter,
      ...(priority && { priority }),
      ...(category && { category }),
      ...(assignedTo !== undefined && { assignedTo }),
      ...(challengeId && { challengeId }),
      // SQLite's LIKE (used for `contains`) is case-insensitive for ASCII.
      ...(search && { topic: { contains: search } }),
    };

    const pageSize = Math.min(positiveInt(req.query.pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
    const page = positiveInt(req.query.page, 1);

    const [total, conversations] = await Promise.all([
      prisma.conversation.count({ where }),
      prisma.conversation.findMany({
        where,
        orderBy: [{ isPinned: "desc" }, { lastActivityAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          challenge: { select: { id: true, title: true, status: true } },
          _count: { select: { posts: true } },
        },
      }),
    ]);

    // Derived per-page: distinct posters and whether any post is accepted.
    const ids = conversations.map((c) => c.id);
    const [participantRows, acceptedRows] = await Promise.all([
      prisma.post.groupBy({ by: ["conversationId", "user"], where: { conversationId: { in: ids } } }),
      prisma.post.groupBy({
        by: ["conversationId"],
        where: { conversationId: { in: ids }, isAcceptedAnswer: true },
      }),
    ]);
    const participantCounts = new Map<string, number>();
    for (const row of participantRows) {
      participantCounts.set(row.conversationId, (participantCounts.get(row.conversationId) ?? 0) + 1);
    }
    const accepted = new Set(acceptedRows.map((r) => r.conversationId));

    res.json({
      items: conversations.map((c) =>
        toConversationSummary(c, participantCounts.get(c.id) ?? 0, accepted.has(c.id)),
      ),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      facets,
    });
  }),
);

// ---------------------------------------------------------------------------
// GET /conversations/:id — conversation with its posts and participants.
// ---------------------------------------------------------------------------
conversationsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, ...visibilityScope(req) },
      include: {
        challenge: { select: { id: true, title: true, status: true } },
        posts: { orderBy: { postNumber: "asc" } },
        _count: { select: { posts: true } },
      },
    });
    if (!conversation) throw new HttpError(404, `Conversation ${req.params.id} not found`);

    const participants = deriveParticipants(conversation.posts);
    res.json({
      ...toConversationSummary(
        conversation,
        participants.length,
        conversation.posts.some((p) => p.isAcceptedAnswer),
      ),
      description: conversation.description,
      participants,
      posts: conversation.posts.map(toPostDto),
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /conversations — start a conversation about a challenge.
// ---------------------------------------------------------------------------
conversationsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = parseBody(createConversationSchema, req.body);
    const role = getRole(req);

    const challengeId = body.challengeId.toUpperCase();
    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge || (role !== "support" && challenge.status !== LEARNER_VISIBLE_CHALLENGE_STATUS)) {
      throw new HttpError(404, `Challenge ${challengeId} not found`);
    }

    const id = await withUniqueRetry(() =>
      prisma.$transaction(async (tx) => {
        const now = new Date();
        const newId = await nextConversationId(tx);
        await tx.conversation.create({
          data: {
            id: newId,
            topic: body.topic,
            category: DEFAULT_CATEGORY,
            challengeId,
            status: "open",
            priority: "medium",
            createdAt: now,
            lastActivityAt: now,
            tags: JSON.stringify([...new Set(body.tags.map((t) => t.toLowerCase()))]),
            posts: {
              create: {
                postNumber: 1,
                user: body.user,
                userRole: role,
                content: body.content,
                timestamp: now,
              },
            },
          },
        });
        return newId;
      }),
    );

    res.status(201).location(`/conversations/${id}`).json({ id });
  }),
);

// ---------------------------------------------------------------------------
// POST /conversations/:id/messages — reply (as learner or support).
// ---------------------------------------------------------------------------
conversationsRouter.post(
  "/:id/messages",
  asyncHandler(async (req, res) => {
    const body = parseBody(createMessageSchema, req.body);
    const role = getRole(req);
    const conversation = await findVisibleConversation(req, req.params.id);

    // Locked threads are read-only for learners; support can still step in.
    if (conversation.isLocked && role !== "support") {
      throw new HttpError(409, "This conversation is locked");
    }

    const post = await withUniqueRetry(() =>
      prisma.$transaction(async (tx) => {
        const now = new Date();
        const { _max } = await tx.post.aggregate({
          where: { conversationId: conversation.id },
          _max: { postNumber: true },
        });
        const created = await tx.post.create({
          data: {
            conversationId: conversation.id,
            postNumber: (_max.postNumber ?? 0) + 1,
            user: body.user,
            userRole: role,
            content: body.content,
            timestamp: now,
          },
        });
        await tx.conversation.update({
          where: { id: conversation.id },
          data: {
            lastActivityAt: now,
            // A support reply to an open question marks it answered. Other
            // transitions (resolve, close, reopen) are explicit via PATCH.
            ...(role === "support" && conversation.status === "open" && { status: "answered" }),
          },
        });
        return created;
      }),
    );

    res.status(201).json(toPostDto(post));
  }),
);

// ---------------------------------------------------------------------------
// PATCH /conversations/:id — support-only triage (status, assignee, etc).
// ---------------------------------------------------------------------------
conversationsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    if (getRole(req) !== "support") {
      throw new HttpError(403, "Only support can update conversations");
    }
    const body = parseBody(updateConversationSchema, req.body);
    if (Object.keys(body).length === 0) {
      throw new HttpError(400, "Provide at least one field to update");
    }
    const conversation = await findVisibleConversation(req, req.params.id);

    // Keep resolution time consistent with status: set when a conversation is
    // first resolved/closed, cleared if it's reopened.
    let resolutionTimeHours: number | null | undefined;
    if (body.status !== undefined) {
      const wasResolved = RESOLVED_STATUSES.includes(conversation.status);
      const isResolved = RESOLVED_STATUSES.includes(body.status);
      if (isResolved && !wasResolved) {
        resolutionTimeHours = hoursBetween(conversation.createdAt, new Date());
      } else if (!isResolved) {
        resolutionTimeHours = null;
      }
    }

    const updated = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        ...body,
        ...(resolutionTimeHours !== undefined && { resolutionTimeHours }),
      },
      include: {
        challenge: { select: { id: true, title: true, status: true } },
        _count: { select: { posts: true } },
      },
    });

    const [participants, accepted] = await Promise.all([
      prisma.post.groupBy({ by: ["user"], where: { conversationId: updated.id } }),
      prisma.post.count({ where: { conversationId: updated.id, isAcceptedAnswer: true } }),
    ]);
    res.json(toConversationSummary(updated, participants.length, accepted > 0));
  }),
);

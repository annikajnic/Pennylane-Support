import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";
import type { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Express 4 doesn't forward rejected promises to the error handler on its own.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

// Query params can arrive as arrays (?a=1&a=2) or be absent; treat blanks as absent.
export function queryString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found" });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Malformed JSON bodies from express.json().
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Request body must be valid JSON" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};

// SQLite compares text case-sensitively and Prisma's `mode: "insensitive"` isn't
// supported there, so filters are resolved against the values actually stored:
// "beginner" -> "Beginner". An unmatched input is returned unchanged, so the
// query simply finds nothing rather than silently ignoring the filter.
export function matchStoredValue(
  input: string | undefined,
  storedValues: string[],
): string | undefined {
  if (input === undefined) return undefined;
  const lower = input.toLowerCase();
  return storedValues.find((v) => v.toLowerCase() === lower) ?? input;
}

// Validates a request body against a zod schema, turning failures into a 400
// whose message names the offending field(s).
export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    const message = result.error.issues
      .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
      .join("; ");
    throw new HttpError(400, message);
  }
  return result.data;
}

function positiveInt(value: unknown, fallback: number): number {
  const n = Number(queryString(value));
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

// Reads ?page and ?pageSize, falling back to defaults on missing/invalid input
// and capping the page size.
export function parsePagination(
  query: Record<string, unknown>,
  { defaultPageSize, maxPageSize }: { defaultPageSize: number; maxPageSize: number },
) {
  const pageSize = Math.min(positiveInt(query.pageSize, defaultPageSize), maxPageSize);
  const page = positiveInt(query.page, 1);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

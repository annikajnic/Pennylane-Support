import type { Request } from "express";

// No real auth: the client declares its role via the X-Role header, mirroring
// the UI's "I am: learner / support" toggle. Anything else — including a
// missing header — is treated as a learner, so the restrictive view is the default.
export type Role = "learner" | "support";

export function getRole(req: Request): Role {
  return req.get("x-role")?.trim().toLowerCase() === "support" ? "support" : "learner";
}

// Draft and archived challenges are support-only.
export const LEARNER_VISIBLE_CHALLENGE_STATUS = "published";

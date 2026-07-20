import type { SessionUser } from "@/server/auth";

/**
 * Authorization rules.
 *
 * Pure predicates over a session user — no session lookup, no redirects, no
 * Next.js. `auth-guards.ts` is the machinery that *obtains* a user and reacts
 * when there isn't one; this is the rule about what a user we already have is
 * allowed to do. Keeping them apart means services can state the rule without
 * pulling in the router, and the rule stays testable on its own.
 */

/**
 * Owner-or-admin (architectural invariant 6), in one place so every mutation
 * spells the rule the same way.
 */
export function canManageEvent(user: SessionUser, ownerId: string): boolean {
  return user.id === ownerId || user.role === "ADMIN";
}

// Server-side access checks (task 2.4).
//
// The proxy (`src/proxy.ts`) only performs an optimistic cookie check — it
// never validates a session against the database. These helpers are the real
// authorization boundary, and every protected page, Server Action, and route
// handler must go through one of them. Treat a page that relies solely on the
// proxy as unprotected.
//
// Two families, because the right failure differs by caller:
//
//   • `requireUser` / `requireAdmin` — for pages and layouts. They redirect,
//     which is the correct UX for a navigation.
//   • `getAuthenticatedUser` / `getAdminUser` — for Server Actions and route
//     handlers. They return a `Result`, because an action's caller needs to
//     render an error, not receive a redirect mid-mutation.

import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DEFAULT_AUTHENTICATED_PATH, PATHNAME_HEADER } from "@/config/routes";
import { loginPathWithReturnTo } from "@/lib/return-to";
import { err, ok, type Result } from "@/server/services/result";
import { auth, type SessionUser } from "@/server/auth";

/**
 * The current session's user, or `null`.
 *
 * Wrapped in React's `cache` so a layout, its page, and any guard they call
 * share a single validation per request instead of hitting the session store
 * once per call site.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
});

export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "ADMIN";
}

/** The path the user is currently on, as recorded by the proxy. */
async function currentPathname(): Promise<string | null> {
  return (await headers()).get(PATHNAME_HEADER);
}

/**
 * Requires an authenticated user, redirecting to login otherwise.
 *
 * Email verification is not re-checked here: `requireEmailVerification` means
 * Better Auth never issues a session to an unverified account in the first
 * place, so holding a session *is* proof of verification (FR-3).
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (user) return user;

  redirect(loginPathWithReturnTo(await currentPathname()));
}

/**
 * Requires an admin (FR-4).
 *
 * A signed-in non-admin is sent to their dashboard rather than to login —
 * bouncing them to a login form they've already completed reads as a bug, and
 * re-authenticating would not change the outcome.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "ADMIN") return user;

  redirect(DEFAULT_AUTHENTICATED_PATH);
}

/** `requireUser` for Server Actions and route handlers. */
export async function getAuthenticatedUser(): Promise<Result<SessionUser>> {
  const user = await getCurrentUser();
  return user ? ok(user) : err({ type: "UNAUTHENTICATED" });
}

/** `requireAdmin` for Server Actions and route handlers. */
export async function getAdminUser(): Promise<Result<SessionUser>> {
  const result = await getAuthenticatedUser();
  if (!result.ok) return result;

  return result.value.role === "ADMIN"
    ? result
    : err({ type: "FORBIDDEN", reason: "Admin role required" });
}

/**
 * Owner-or-admin authorization (architectural invariant 6), in one place so
 * every mutation spells the rule the same way.
 */
export function canManageEvent(user: SessionUser, ownerId: string): boolean {
  return user.id === ownerId || user.role === "ADMIN";
}

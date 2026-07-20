/**
 * Service results.
 *
 * Services return values; they do not throw for expected outcomes. "Slug is
 * taken" and "you don't own this event" are ordinary results of asking, not
 * exceptions — modelling them as data means the compiler forces every caller
 * to handle them, and route handlers can map errors to responses exhaustively
 * instead of guessing from a message string.
 *
 * Genuine bugs and infrastructure failures still throw. The rule of thumb: if
 * a competent user could cause it, it belongs in `DomainError`.
 */

export type DomainError =
  /** The thing doesn't exist, or the caller isn't allowed to know it does. */
  | { type: "NOT_FOUND"; resource: string }
  /** Authenticated, but not the owner and not an admin. */
  | { type: "FORBIDDEN"; reason?: string }
  /** Not authenticated, or authenticated but not email-verified (FR-3). */
  | { type: "UNAUTHENTICATED" }
  /** Server-side Zod validation failed; `issues` is field path → messages. */
  | { type: "VALIDATION_FAILED"; issues: Record<string, string[]> }
  /** BR-3: another event already holds this slug. */
  | { type: "SLUG_TAKEN" }
  /** BR-4: the slug is on the reserved blocklist. */
  | { type: "SLUG_RESERVED" }
  /** BR-5: the slug is frozen because the event has been published. */
  | { type: "SLUG_LOCKED" }
  /** BR-11: a per-event content limit from `config/limits.ts` was reached. */
  | { type: "LIMIT_EXCEEDED"; limit: number; resource: string }
  /** BR-9: this event already has a pending publish request. */
  | { type: "PENDING_REQUEST_EXISTS" }
  /** BR-14: submission blocked; `fields` names what is missing. */
  | { type: "INCOMPLETE_CONTENT"; fields: string[] }
  /** The action doesn't apply in the event's current state (BR-6). */
  | { type: "INVALID_STATE"; current: string; attempted: string }
  /** Autosave conflict: another session wrote first (tech-stack decision 3). */
  | { type: "STALE_WRITE"; updatedAt: Date }
  /** NFR-5: an abuse-protected endpoint refused the request. */
  | { type: "RATE_LIMITED"; retryAfterMs: number };

export type Result<T, E extends DomainError = DomainError> =
  { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E extends DomainError>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Narrowing helpers. Useful where a `Result` flows through a generic pipeline
 * and TypeScript needs the discriminant checked in an expression position.
 */
export function isOk<T, E extends DomainError>(
  result: Result<T, E>,
): result is { ok: true; value: T } {
  return result.ok;
}

export function isErr<T, E extends DomainError>(
  result: Result<T, E>,
): result is { ok: false; error: E } {
  return !result.ok;
}

/**
 * Asserts a switch over `DomainError["type"]` is exhaustive. Adding a new
 * error variant then fails to compile at every incomplete mapping, which is
 * the point — an unmapped error must never silently become a 500.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}

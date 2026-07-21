import "server-only";

import { PREVIEW_GUESS_MAX_PER_HOUR, PREVIEW_GUESS_WINDOW_MS } from "@/config/limits";
import type { EventDraft } from "@/content/serializer";
import type { SessionUser } from "@/server/auth";
import { generatePreviewToken, isPreviewTokenShaped } from "@/lib/preview-token";
import { rateLimiter } from "@/server/adapters/rate-limit";
import { findEventById, findEventDraft } from "@/server/repositories/event-repository";
import * as tokens from "@/server/repositories/preview-token-repository";
import { loadManageable } from "@/server/services/event-service";
import { err, ok, type Result } from "@/server/services/result";

/**
 * Preview links (Phase 6, FR-25..FR-27).
 *
 * A preview link is a shareable, read-only view of an event's *draft* for
 * someone who has no account — the teammate reviewing copy, the speaker
 * checking their own bio. It is the anonymous counterpart to FR-24's owner
 * preview, and it renders exactly the same thing through exactly the same
 * template.
 *
 * Two rules shape everything here:
 *
 *   1. **One active token per event.** Issuing is idempotent from the owner's
 *      point of view — "regenerate" and "create" are the same operation — and
 *      the repository revokes the outstanding token inside the same
 *      transaction, so there is never a window with two live links.
 *   2. **The token is the entire authorization for reading.** So the read path
 *      takes no `SessionUser` at all, and the management path takes nothing
 *      *but* a `SessionUser` — the two never share a code path, which is what
 *      makes it impossible for a bug in one to widen the other.
 */

export interface PreviewLink {
  token: string;
  createdAt: Date;
}

/** Everything the tokenized route needs to render, and nothing more. */
export interface TokenPreview {
  eventId: string;
  displayName: string;
  templateId: string;
  draft: EventDraft;
}

// ---------------------------------------------------------------------------
// Owner-facing management (FR-25, FR-26)
// ---------------------------------------------------------------------------

/**
 * The event's active link, or `null` if it has none.
 *
 * `null` is a successful result, not `NOT_FOUND`: "this event has no preview
 * link" is the ordinary starting state of every event, and modelling it as an
 * error would make the caller handle a non-problem.
 */
export async function getPreviewLink(
  user: SessionUser,
  eventId: string,
): Promise<Result<PreviewLink | null>> {
  const loaded = await loadManageable(user, eventId);
  if (!loaded.ok) return loaded;

  const active = await tokens.findActiveToken(eventId);
  if (active === null) return ok(null);

  return ok({ token: active.token, createdAt: active.createdAt });
}

/**
 * Issues a link, revoking any existing one (FR-25, FR-26).
 *
 * Deliberately one function rather than `create` plus `regenerate`. The two
 * differ only in whether a token already existed, which is a fact the server
 * can see for itself — and splitting them would mean a client that guessed
 * wrong either errored or, worse, left a second token live.
 */
export async function issuePreviewLink(
  user: SessionUser,
  eventId: string,
): Promise<Result<PreviewLink>> {
  const loaded = await loadManageable(user, eventId);
  if (!loaded.ok) return loaded;

  const issued = await tokens.issueToken(eventId, generatePreviewToken());
  return ok({ token: issued.token, createdAt: issued.createdAt });
}

/**
 * FR-26: revokes the active link. Takes effect on the very next request —
 * nothing caches the token → event mapping, and the preview route is rendered
 * per request for exactly this reason.
 *
 * Revoking when there is nothing to revoke succeeds. The caller asked for a
 * state ("no live link"), and that state holds either way; an error would only
 * ever fire on a double-click.
 */
export async function revokePreviewLink(
  user: SessionUser,
  eventId: string,
): Promise<Result<{ revoked: number }>> {
  const loaded = await loadManageable(user, eventId);
  if (!loaded.ok) return loaded;

  const revoked = await tokens.revokeActiveTokens(eventId);
  return ok({ revoked });
}

// ---------------------------------------------------------------------------
// Anonymous read (FR-25)
// ---------------------------------------------------------------------------

/**
 * Resolves a token to the draft it grants sight of.
 *
 * Every failure — malformed, unknown, revoked, or belonging to a deleted event
 * — is the same `NOT_FOUND`. The holder of a bad link must not be able to tell
 * "this was never a link" from "this link was revoked": the difference would
 * confirm that a given event exists and that someone thought better of sharing
 * it, and it is information the page has no reason to spend.
 *
 * The shape check runs first so that a probe at the namespace costs no query.
 *
 * ## Rate limiting the guessing (task 9.4)
 *
 * A shaped-but-invalid token is the shape of a guess, and each one costs a
 * database lookup. `clientIp` bounds how many an address can force per hour
 * (`PREVIEW_GUESS_MAX_PER_HOUR`), which is defence in depth on top of the
 * 256-bit space and, more practically, a cap on the lookups and log noise a
 * sprayer can generate.
 *
 * Three properties make it safe to apply here:
 *
 *   - **Only failures count.** A valid token resolves and returns before any
 *     `consume`, so a legitimate viewer refreshing a live link never spends
 *     against the limit. Only misses do.
 *   - **The check is free and precedes the query.** `peek` is a single indexed
 *     read with no write, so once an address is over budget its guesses are
 *     turned away *before* the lookup — which is the database protection.
 *   - **Being over the limit is still just `NOT_FOUND`.** A rate-limited guess
 *     is indistinguishable from any other miss, so the limit leaks nothing it
 *     is trying to protect. (Contrast the report endpoint, where the limit is
 *     an honest 429 because the reporter needs to know their report didn't
 *     land — here the guesser is owed no such courtesy.)
 *
 * `clientIp` is `null` when the address can't be determined (`clientIpFrom`);
 * that path skips the limiter rather than sharing one bucket, exactly as report
 * submission does.
 */
export async function loadTokenPreview(
  token: string,
  clientIp: string | null,
): Promise<Result<TokenPreview>> {
  const missing = err({ type: "NOT_FOUND" as const, resource: "preview link" });

  // Malformed tokens cost no query, so spend no rate-limit write on them
  // either — counting them would turn a free path into a database write and
  // add load in the name of shedding it.
  if (!isPreviewTokenShaped(token)) return missing;

  const guessKey = clientIp === null ? null : `preview-guess:${clientIp}`;

  // Over budget: turn the guess away before it can touch the database.
  if (guessKey !== null && !(await rateLimiter.peek(guessKey, PREVIEW_GUESS_MAX_PER_HOUR))) {
    return missing;
  }

  const eventId = await tokens.findEventIdByToken(token);
  if (eventId === null) return countMiss(guessKey, missing);

  // Soft-deleted events are filtered by the repository, so a link to one stops
  // working the moment the owner deletes it without any bookkeeping here.
  const event = await findEventById(eventId);
  if (event === null) return countMiss(guessKey, missing);

  const draft = await findEventDraft(eventId);
  if (draft === null) return countMiss(guessKey, missing);

  return ok({
    eventId: event.id,
    displayName: event.displayName,
    templateId: event.templateId,
    draft,
  });
}

/**
 * Records a failed lookup against the guessing budget and returns the same
 * `NOT_FOUND` the caller was going to return anyway.
 *
 * Written as a pass-through so the failure branches above stay one line each
 * and cannot accidentally skip the accounting.
 */
async function countMiss<T>(guessKey: string | null, missing: Result<T>): Promise<Result<T>> {
  if (guessKey !== null) {
    await rateLimiter.consume(guessKey, PREVIEW_GUESS_MAX_PER_HOUR, PREVIEW_GUESS_WINDOW_MS);
  }
  return missing;
}

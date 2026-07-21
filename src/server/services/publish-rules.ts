import type { PublicationStatus } from "@/generated/prisma/enums";

/**
 * The publication state machine (BR-6, BR-8a, BR-10).
 *
 * Pure functions over an event's publication state — no database, no session,
 * no Prisma — for the same reason `event-rules.ts` is: these are the rules that
 * decide whether someone's site is visible to the world, and they deserve to be
 * exhaustively unit-testable rather than reachable only through a service call
 * that needs a live database and a seeded event.
 *
 * Every rule here is stated as "may this transition happen", never "do it".
 * Services apply them; repositories additionally scope their writes to the
 * expected `from` status, so a state that changes between the check and the
 * write cannot slip through (the same belt-and-braces as BR-5's slug lock).
 */

/**
 * The subset of an event these rules read.
 *
 * `hasLiveSnapshot` rather than the id itself: no rule cares *which* snapshot
 * is live, only whether one exists, and taking the narrower input means a rule
 * cannot accidentally start depending on snapshot identity.
 */
export interface PublishState {
  publicationStatus: PublicationStatus;
  hasLiveSnapshot: boolean;
  /**
   * BR-10: what the event's status was when an admin suspended it, so restoring
   * puts it back exactly where it was rather than guessing.
   *
   * `null` whenever the event is not suspended.
   */
  suspendedFromStatus: PublicationStatus | null;
}

/**
 * FR-29: whether the owner may submit for review.
 *
 * Allowed from every state except `SUSPENDED`. A suspended event must not have
 * a route back to live that runs through the ordinary queue — an admin
 * approving a resubmission in the normal flow would silently undo another
 * admin's suspension (BR-10 makes restoration an admin-only act, deliberately).
 *
 * Note this says nothing about pending requests: BR-9 is enforced by the
 * database's unique index on `pendingEventId`, not here, because only the
 * database can settle a race between two concurrent submissions.
 */
export function canSubmitForReview(state: PublishState): boolean {
  return state.publicationStatus !== "SUSPENDED";
}

/** FR-35: the owner takes their own live site offline, no approval needed. */
export function canUnpublish(state: PublishState): boolean {
  return state.publicationStatus === "PUBLISHED";
}

/**
 * BR-8a: republishing an unchanged approved snapshot needs no new review.
 *
 * The snapshot is already approved — it was live until the owner chose
 * otherwise — so putting it back is restoring a decision an admin already made,
 * not asking for a new one. Draft edits made since then are irrelevant here:
 * they are not in the snapshot, and they reach the public site only by going
 * through review like anything else.
 *
 * `hasLiveSnapshot` is the guard that matters. An event can reach `UNPUBLISHED`
 * only by having been published, so the false case is unreachable today — but
 * republishing an event with nothing to republish would put an empty page live,
 * and the check costs one boolean.
 */
export function canRepublish(state: PublishState): boolean {
  return state.publicationStatus === "UNPUBLISHED" && state.hasLiveSnapshot;
}

/**
 * FR-44 / BR-10: an admin takes a site offline.
 *
 * `UNPUBLISHED` is included on purpose, and it is the case worth explaining: an
 * unpublished event can be put back live by its owner at any moment without
 * review (`canRepublish`). If suspension only applied to currently-live sites,
 * an owner could unpublish the moment a report landed and republish the moment
 * the admin looked away. Suspending is the only action that actually stops that.
 *
 * `NEVER_PUBLISHED` is excluded because nothing about it is public and it
 * cannot become public except through the review queue, where an admin already
 * has the final say.
 */
export function canSuspend(state: PublishState): boolean {
  return state.publicationStatus === "PUBLISHED" || state.publicationStatus === "UNPUBLISHED";
}

/** BR-10: only an admin lifts a suspension. */
export function canRestore(state: PublishState): boolean {
  return state.publicationStatus === "SUSPENDED";
}

/**
 * Where a restore puts the event.
 *
 * Restoring returns the event to the state suspension interrupted, which is why
 * `suspendedFromStatus` is stored rather than derived: a site the owner had
 * already taken offline must not come back *live* just because an admin lifted
 * a suspension, and a site that was live must not stay dark because the admin
 * has no way to put it back.
 *
 * The fallbacks handle rows suspended before that column existed, and rows
 * whose live snapshot disappeared underneath them. Both resolve towards
 * `UNPUBLISHED` — the state that makes the site invisible and leaves the choice
 * with its owner.
 */
export function restoredStatus(state: PublishState): PublicationStatus {
  if (!state.hasLiveSnapshot) return "UNPUBLISHED";

  return state.suspendedFromStatus === "PUBLISHED" ? "PUBLISHED" : "UNPUBLISHED";
}

/**
 * Whether the public site is reachable in this state (FR-42).
 *
 * Phase 8's `[site]` route is the real consumer; it lives here so "is this
 * event live" has exactly one definition, rather than a route rediscovering it
 * as `status === "PUBLISHED"` and drifting the day a state is added.
 */
export function isPubliclyVisible(state: PublishState): boolean {
  return state.publicationStatus === "PUBLISHED" && state.hasLiveSnapshot;
}

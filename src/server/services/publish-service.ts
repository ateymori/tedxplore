import "server-only";

import type { CompletenessIssue } from "@/content/completeness";
import type { PublishRequestStatus } from "@/generated/prisma/enums";
import type { SessionUser } from "@/server/auth";
import { checkCompleteness } from "@/content/completeness";
import { draftToEventContent } from "@/content/serializer";
import { findEventDraft } from "@/server/repositories/event-repository";
import * as events from "@/server/repositories/event-repository";
import { isUniqueConstraintError } from "@/server/repositories/prisma";
import * as requests from "@/server/repositories/publish-request-repository";
import { createSnapshot } from "@/server/repositories/snapshot-repository";
import { findOwnerContact } from "@/server/repositories/user-repository";
import { sendSubmissionReceived } from "@/server/services/publish-notifications";
import {
  canRepublish,
  canSubmitForReview,
  canUnpublish,
  type PublishState,
} from "@/server/services/publish-rules";
import { loadManageable } from "@/server/services/event-service";
import { err, ok, type Result } from "@/server/services/result";

/**
 * The owner's half of the publishing lifecycle (tasks 7.1 and 7.4).
 *
 * Everything an organizer can do to their own site without an admin: submit it
 * for review, withdraw that submission, take a live site offline, and put it
 * back. The admin's half — approve, reject, suspend, restore — is
 * `review-service.ts`, and the split is by *who is allowed*, not by subject
 * matter, so neither module ever has to branch on the caller's role.
 *
 * Both modules share `publish-rules.ts` for the state machine and
 * `publish-notifications.tsx` for email.
 */

/** The publication state, in the shape `publish-rules.ts` reads. */
function publishState(event: {
  publicationStatus: PublishState["publicationStatus"];
  liveSnapshotId: string | null;
  suspendedFromStatus: PublishState["publicationStatus"] | null;
}): PublishState {
  return {
    publicationStatus: event.publicationStatus,
    hasLiveSnapshot: event.liveSnapshotId !== null,
    suspendedFromStatus: event.suspendedFromStatus,
  };
}

// ---------------------------------------------------------------------------
// Submitting for review (FR-29, FR-30, FR-31)
// ---------------------------------------------------------------------------

export interface SubmissionSummary {
  requestId: string;
  snapshotId: string;
  submittedAt: Date;
}

/**
 * FR-29/FR-30: freeze the draft into a snapshot and queue it for review.
 *
 * The order here matters and is the whole task:
 *
 *   1. **Serialize first, then check completeness.** BR-14 is evaluated against
 *      `EventContent` — what would actually be published — not against the
 *      draft rows. A speaker with a blank name is in the draft but not in the
 *      content, and judging the draft would let submissions through on the
 *      strength of rows the public site is about to drop (BR-13).
 *   2. **Snapshot the same content that was checked.** The `EventContent` that
 *      passed the gate is the object written to the snapshot — not a second
 *      serialization — so there is no window in which an edit lands between the
 *      check and the freeze and puts incomplete content into review.
 *   3. **Insert the request last.** BR-9's unique index is what settles two
 *      concurrent submissions, and the loser's snapshot is simply an orphan the
 *      audit trail keeps (BR-8 retains every snapshot anyway).
 */
export async function submitForReview(
  user: SessionUser,
  eventId: string,
): Promise<Result<SubmissionSummary>> {
  const loaded = await loadManageable(user, eventId);
  if (!loaded.ok) return loaded;

  const event = loaded.value;

  if (!canSubmitForReview(publishState(event))) {
    return err({
      type: "INVALID_STATE",
      current: event.publicationStatus,
      attempted: "submit for review",
    });
  }

  // The friendly error. The unique index below is the actual enforcement.
  if ((await requests.findPendingRequest(eventId)) !== null) {
    return err({ type: "PENDING_REQUEST_EXISTS" });
  }

  const draft = await findEventDraft(eventId);
  if (draft === null) return err({ type: "NOT_FOUND", resource: "event" });

  const content = draftToEventContent(draft);

  const completeness = checkCompleteness(content);
  if (!completeness.ok) {
    return err({ type: "INCOMPLETE_CONTENT", issues: completeness.issues });
  }

  const snapshot = await createSnapshot(eventId, content);

  let request;
  try {
    request = await requests.createPublishRequest(eventId, snapshot.id);
  } catch (error) {
    if (isUniqueConstraintError(error)) return err({ type: "PENDING_REQUEST_EXISTS" });
    throw error;
  }

  const owner = await findOwnerContact(event.ownerId);
  if (owner !== null) {
    await sendSubmissionReceived(owner, { id: event.id, displayName: event.displayName });
  }

  return ok({
    requestId: request.id,
    snapshotId: snapshot.id,
    submittedAt: request.submittedAt,
  });
}

/**
 * FR-31: the owner withdraws a pending submission.
 *
 * Cancelling when nothing is pending is a refusal rather than a silent success
 * — the opposite of `revokePreviewLink`, and worth the inconsistency. Revoking
 * a link twice reaches the state the user asked for either way; cancelling a
 * submission that is no longer pending usually means it was *just decided*, and
 * telling the owner "done" would leave them believing they stopped a review
 * that in fact approved and published their site seconds earlier.
 */
export async function cancelSubmission(
  user: SessionUser,
  eventId: string,
): Promise<Result<{ requestId: string }>> {
  const loaded = await loadManageable(user, eventId);
  if (!loaded.ok) return loaded;

  const pending = await requests.findPendingRequest(eventId);
  if (pending === null) {
    return err({ type: "NOT_FOUND", resource: "pending submission" });
  }

  // Scoped to PENDING in the repository, so a review that resolved between the
  // read above and this write wins rather than being overwritten.
  if (!(await requests.cancelRequest(pending.id))) {
    return err({ type: "NOT_FOUND", resource: "pending submission" });
  }

  return ok({ requestId: pending.id });
}

// ---------------------------------------------------------------------------
// Unpublish / republish (FR-35, BR-8a) — task 7.4
// ---------------------------------------------------------------------------

/** The affected slug, so the calling action knows what to revalidate. */
export interface SiteVisibilityChange {
  slug: string;
}

/**
 * FR-35: take a live site offline. No approval needed — it is the owner's site
 * and making it *less* visible has never needed review.
 *
 * The live snapshot pointer is kept, which is what makes `republish` free.
 */
export async function unpublishEvent(
  user: SessionUser,
  eventId: string,
): Promise<Result<SiteVisibilityChange>> {
  const loaded = await loadManageable(user, eventId);
  if (!loaded.ok) return loaded;

  const event = loaded.value;

  if (!canUnpublish(publishState(event))) {
    return err({
      type: "INVALID_STATE",
      current: event.publicationStatus,
      attempted: "unpublish",
    });
  }

  if (!(await events.unpublishEvent(eventId))) {
    return err({ type: "INVALID_STATE", current: event.publicationStatus, attempted: "unpublish" });
  }

  return ok({ slug: event.slug });
}

/**
 * BR-8a: put the already-approved snapshot back, with no new review.
 *
 * This publishes the *snapshot*, not the draft. An owner who edited while
 * unpublished and expects those edits to appear will not see them — which is
 * correct (invariant 3: only approved content is ever public) and is why the UI
 * says so explicitly rather than leaving it to be discovered.
 */
export async function republishEvent(
  user: SessionUser,
  eventId: string,
): Promise<Result<SiteVisibilityChange>> {
  const loaded = await loadManageable(user, eventId);
  if (!loaded.ok) return loaded;

  const event = loaded.value;

  if (!canRepublish(publishState(event))) {
    return err({
      type: "INVALID_STATE",
      current: event.publicationStatus,
      attempted: "republish",
    });
  }

  if (!(await events.republishEvent(eventId))) {
    return err({ type: "INVALID_STATE", current: event.publicationStatus, attempted: "republish" });
  }

  return ok({ slug: event.slug });
}

// ---------------------------------------------------------------------------
// Status for the owner's UI
// ---------------------------------------------------------------------------

export interface PublishStatus {
  publicationStatus: PublishState["publicationStatus"];
  /** The pending request, if the event has one (FR-31). */
  pending: { requestId: string; submittedAt: Date } | null;
  /** The most recent decision, so a rejection reason survives (FR-33). */
  lastDecision: {
    status: PublishRequestStatus;
    reviewedAt: Date | null;
    rejectionReason: string | null;
  } | null;
  canSubmit: boolean;
  canCancel: boolean;
  canUnpublish: boolean;
  canRepublish: boolean;
  /** BR-14 problems blocking submission right now, so the UI can warn early. */
  blockingIssues: CompletenessIssue[];
}

/**
 * Everything the editor's publish panel renders, in one call.
 *
 * The completeness check runs here too, so the organizer sees what is missing
 * *before* pressing submit rather than as the result of pressing it. Both paths
 * call `checkCompleteness` on the same serialized content, so the preview and
 * the refusal can never disagree.
 */
export async function getPublishStatus(
  user: SessionUser,
  eventId: string,
): Promise<Result<PublishStatus>> {
  const loaded = await loadManageable(user, eventId);
  if (!loaded.ok) return loaded;

  const event = loaded.value;
  const state = publishState(event);

  const [pending, history, draft] = await Promise.all([
    requests.findPendingRequest(eventId),
    requests.listRequestsForEvent(eventId),
    findEventDraft(eventId),
  ]);

  const completeness = draft === null ? null : checkCompleteness(draftToEventContent(draft));

  // The latest request that was actually decided — a pending one is reported
  // separately, and a cancelled one is not a decision anybody needs told about.
  const lastDecision =
    history.find((request) => request.status === "APPROVED" || request.status === "REJECTED") ??
    null;

  return ok({
    publicationStatus: event.publicationStatus,
    pending: pending === null ? null : { requestId: pending.id, submittedAt: pending.submittedAt },
    lastDecision:
      lastDecision === null
        ? null
        : {
            status: lastDecision.status,
            reviewedAt: lastDecision.reviewedAt,
            rejectionReason: lastDecision.rejectionReason,
          },
    canSubmit: canSubmitForReview(state) && pending === null,
    canCancel: pending !== null,
    canUnpublish: canUnpublish(state),
    canRepublish: canRepublish(state),
    blockingIssues: completeness === null || completeness.ok ? [] : completeness.issues,
  });
}

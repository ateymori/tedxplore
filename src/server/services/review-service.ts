import "server-only";

import type { EventContent } from "@/content/event-content";
import type { PublicationStatus, PublishRequestStatus } from "@/generated/prisma/enums";
import type { SessionUser } from "@/server/auth";
import { eventContentSchema } from "@/content/event-content";
import { rejectionSchema, suspensionSchema } from "@/lib/validation/review";
import * as events from "@/server/repositories/event-repository";
import * as requests from "@/server/repositories/publish-request-repository";
import { findOwnerContact } from "@/server/repositories/user-repository";
import {
  sendSiteApproved,
  sendSiteRejected,
  sendSiteSuspended,
} from "@/server/services/publish-notifications";
import { canRestore, canSuspend, restoredStatus } from "@/server/services/publish-rules";
import { err, ok, type Result } from "@/server/services/result";
import { parseInput } from "@/server/services/validation";

/**
 * The admin's half of the publishing lifecycle (tasks 7.2, 7.3, 7.5).
 *
 * Split from `publish-service.ts` by *who may call it* rather than by subject:
 * every function here requires an `ADMIN`, every function there requires the
 * owner-or-admin rule. Neither module ever branches on a role, which is what
 * makes "could a normal user reach this?" answerable by looking at the import.
 *
 * The role check is repeated in each function rather than assumed from the
 * `/admin` route prefix. The prefix is enforced by a layout guard, but a
 * service that trusts its caller's location is one refactor away from being
 * reachable from somewhere else (the proxy is explicitly not an authorization
 * boundary — see `auth-guards.ts`).
 */

function requireAdminRole(user: SessionUser): Result<SessionUser> {
  return user.role === "ADMIN" ? ok(user) : err({ type: "FORBIDDEN", reason: "admin only" });
}

// ---------------------------------------------------------------------------
// The queue (task 7.2)
// ---------------------------------------------------------------------------

export interface QueueEntry {
  requestId: string;
  submittedAt: Date;
  event: {
    id: string;
    slug: string;
    displayName: string;
    publicationStatus: PublicationStatus;
  };
  owner: { email: string; name: string | null };
  /** True when this event has been live before — a re-review, not a first look. */
  resubmission: boolean;
}

export async function listReviewQueue(user: SessionUser): Promise<Result<QueueEntry[]>> {
  const auth = requireAdminRole(user);
  if (!auth.ok) return auth;

  const pending = await requests.listPendingRequests();

  return ok(
    pending.map((request) => ({
      requestId: request.id,
      submittedAt: request.submittedAt,
      event: {
        id: request.event.id,
        slug: request.event.slug,
        displayName: request.event.displayName,
        publicationStatus: request.event.publicationStatus,
      },
      owner: {
        email: request.event.owner.email,
        name: request.event.owner.name.trim() || null,
      },
      resubmission: request.event.publicationStatus !== "NEVER_PUBLISHED",
    })),
  );
}

/** Everything the review detail screen shows (FR-43). */
export interface ReviewDetail {
  requestId: string;
  status: PublishRequestStatus;
  submittedAt: Date;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  reviewer: { email: string; name: string | null } | null;
  event: {
    id: string;
    slug: string;
    displayName: string;
    templateId: string;
    publicationStatus: PublicationStatus;
    createdAt: Date;
    deleted: boolean;
  };
  /** BR-16: the licensing attestation, verified by hand in V1. */
  licensing: {
    tedEventUrl: string;
    licenseHolderName: string;
    authorizationConfirmedAt: Date;
  };
  owner: { id: string; email: string; name: string | null; createdAt: Date };
  /** The exact submitted document — what the reviewer is deciding about. */
  content: EventContent;
  /** True when this snapshot is the one currently live. */
  isLive: boolean;
}

/**
 * Loads a request for review, parsing the snapshot through the same schema the
 * public renderer uses.
 *
 * That parse is the guarantee the whole review rests on: the reviewer is shown
 * the stored snapshot rendered by the real template, not a re-serialization of
 * the draft — which by now may have moved on (FR-31 lets the owner keep
 * editing). Approving something other than what was reviewed is the one failure
 * this screen exists to prevent.
 */
export async function getReviewDetail(
  user: SessionUser,
  requestId: string,
): Promise<Result<ReviewDetail>> {
  const auth = requireAdminRole(user);
  if (!auth.ok) return auth;

  const request = await requests.findRequestForReview(requestId);
  if (request === null) return err({ type: "NOT_FOUND", resource: "publish request" });

  const parsed = eventContentSchema.safeParse(request.snapshot.content);
  if (!parsed.success) {
    // A snapshot that no longer parses is a deployment problem, not user input:
    // it means `EventContent` changed without the upgrader being taught about
    // it (invariant 2). Failing loudly is right — silently rendering a partial
    // site would get it approved.
    throw new Error(
      `Snapshot ${request.snapshotId} does not match the current EventContent schema. ` +
        `Phase 8's schema-version upgrader is what should be handling this.`,
    );
  }

  const { event } = request;

  return ok({
    requestId: request.id,
    status: request.status,
    submittedAt: request.submittedAt,
    reviewedAt: request.reviewedAt,
    rejectionReason: request.rejectionReason,
    reviewer:
      request.reviewer === null
        ? null
        : { email: request.reviewer.email, name: request.reviewer.name.trim() || null },
    event: {
      id: event.id,
      slug: event.slug,
      displayName: event.displayName,
      templateId: event.templateId,
      publicationStatus: event.publicationStatus,
      createdAt: event.createdAt,
      deleted: event.deletedAt !== null,
    },
    licensing: {
      tedEventUrl: event.tedEventUrl,
      licenseHolderName: event.licenseHolderName,
      authorizationConfirmedAt: event.authorizationConfirmedAt,
    },
    owner: {
      id: event.owner.id,
      email: event.owner.email,
      name: event.owner.name.trim() || null,
      createdAt: event.owner.createdAt,
    },
    content: parsed.data,
    isLive: event.liveSnapshotId === request.snapshotId,
  });
}

// ---------------------------------------------------------------------------
// Decisions (task 7.3)
// ---------------------------------------------------------------------------

/** The affected slug, so the calling action knows what to revalidate. */
export interface DecisionResult {
  eventId: string;
  slug: string;
}

/**
 * FR-32 / BR-7: approve, swapping the live snapshot atomically.
 *
 * The swap and the status change happen in one transaction inside the
 * repository, so the public site never observes a half-applied publish — an
 * event marked PUBLISHED whose `liveSnapshotId` still points at the previous
 * document would serve stale content indefinitely, with nothing to detect it.
 *
 * `approveRequest` is scoped to `status: "PENDING"`, so two admins pressing
 * approve at once produce one approval and one honest "already decided" — the
 * second is `NOT_FOUND` on a *pending* request, not a second swap.
 */
export async function approveRequest(
  user: SessionUser,
  requestId: string,
): Promise<Result<DecisionResult>> {
  const auth = requireAdminRole(user);
  if (!auth.ok) return auth;

  const request = await requests.findRequestForReview(requestId);
  if (request === null) return err({ type: "NOT_FOUND", resource: "publish request" });

  if (request.status !== "PENDING") {
    return err({ type: "INVALID_STATE", current: request.status, attempted: "approve" });
  }

  if (request.event.deletedAt !== null) {
    // The owner deleted the event while it sat in the queue. Publishing it now
    // would put a site live that its owner has asked to be rid of.
    return err({ type: "NOT_FOUND", resource: "event" });
  }

  const firstPublication = request.event.publicationStatus === "NEVER_PUBLISHED";

  const approved = await requests.approveRequest(
    request.id,
    request.eventId,
    request.snapshotId,
    user.id,
  );

  if (!approved) {
    return err({ type: "INVALID_STATE", current: "already decided", attempted: "approve" });
  }

  const owner = await findOwnerContact(request.event.ownerId);
  if (owner !== null) {
    await sendSiteApproved(
      owner,
      { id: request.event.id, slug: request.event.slug, displayName: request.event.displayName },
      firstPublication,
    );
  }

  return ok({ eventId: request.eventId, slug: request.event.slug });
}

/**
 * FR-33: reject with a required reason.
 *
 * The reason is validated server-side rather than trusted from the form,
 * because it is the entire content of the email the organizer receives and the
 * only thing telling them what to change. A blank one turns a rejection into a
 * dead end.
 *
 * Rejection deliberately does not touch `publicationStatus`: a live site whose
 * *resubmission* is rejected stays live on its last approved snapshot (BR-8a).
 * Taking it down would punish an organizer for trying to improve it.
 */
export async function rejectRequest(
  user: SessionUser,
  requestId: string,
  input: unknown,
): Promise<Result<DecisionResult>> {
  const auth = requireAdminRole(user);
  if (!auth.ok) return auth;

  const parsed = parseInput(rejectionSchema, input);
  if (!parsed.ok) return parsed;

  const request = await requests.findRequestForReview(requestId);
  if (request === null) return err({ type: "NOT_FOUND", resource: "publish request" });

  if (request.status !== "PENDING") {
    return err({ type: "INVALID_STATE", current: request.status, attempted: "reject" });
  }

  const rejected = await requests.rejectRequest(request.id, user.id, parsed.value.reason);
  if (!rejected) {
    return err({ type: "INVALID_STATE", current: "already decided", attempted: "reject" });
  }

  const owner = await findOwnerContact(request.event.ownerId);
  if (owner !== null) {
    await sendSiteRejected(
      owner,
      { id: request.event.id, displayName: request.event.displayName },
      parsed.value.reason,
    );
  }

  return ok({ eventId: request.eventId, slug: request.event.slug });
}

// ---------------------------------------------------------------------------
// Suspend / restore (task 7.5)
// ---------------------------------------------------------------------------

/**
 * FR-44 / BR-10: take a site offline by administrative action.
 *
 * The status being interrupted is recorded in the same write, so restoring
 * returns the event exactly where it was rather than guessing (see
 * `restoredStatus`). The reason is optional — a suspension may be an urgent
 * response to abuse, and requiring an essay first would be the wrong trade —
 * but it is passed straight into the owner's email when given.
 */
export async function suspendEvent(
  user: SessionUser,
  eventId: string,
  input: unknown,
): Promise<Result<DecisionResult>> {
  const auth = requireAdminRole(user);
  if (!auth.ok) return auth;

  const parsed = parseInput(suspensionSchema, input);
  if (!parsed.ok) return parsed;

  const event = await events.findEventById(eventId);
  if (event === null) return err({ type: "NOT_FOUND", resource: "event" });

  const state = {
    publicationStatus: event.publicationStatus,
    hasLiveSnapshot: event.liveSnapshotId !== null,
    suspendedFromStatus: event.suspendedFromStatus,
  };

  if (!canSuspend(state)) {
    return err({
      type: "INVALID_STATE",
      current: event.publicationStatus,
      attempted: "suspend",
    });
  }

  if (!(await events.suspendEvent(eventId, event.publicationStatus))) {
    return err({ type: "INVALID_STATE", current: event.publicationStatus, attempted: "suspend" });
  }

  const owner = await findOwnerContact(event.ownerId);
  if (owner !== null) {
    await sendSiteSuspended(
      owner,
      { id: event.id, displayName: event.displayName },
      parsed.value.reason,
    );
  }

  return ok({ eventId: event.id, slug: event.slug });
}

/**
 * BR-10: lift a suspension.
 *
 * No email. The owner was told when it went down and can see the result
 * immediately in their dashboard; a "your site is back" message would be
 * pleasant but would also be the one notification an attacker could use to
 * confirm an address is monitored. If it turns out organizers want it, it is
 * one call to `publish-notifications.tsx`.
 */
export async function restoreEvent(
  user: SessionUser,
  eventId: string,
): Promise<Result<DecisionResult & { restoredTo: PublicationStatus }>> {
  const auth = requireAdminRole(user);
  if (!auth.ok) return auth;

  const event = await events.findEventById(eventId);
  if (event === null) return err({ type: "NOT_FOUND", resource: "event" });

  const state = {
    publicationStatus: event.publicationStatus,
    hasLiveSnapshot: event.liveSnapshotId !== null,
    suspendedFromStatus: event.suspendedFromStatus,
  };

  if (!canRestore(state)) {
    return err({
      type: "INVALID_STATE",
      current: event.publicationStatus,
      attempted: "restore",
    });
  }

  const target = restoredStatus(state);

  if (!(await events.restoreEvent(eventId, target))) {
    return err({ type: "INVALID_STATE", current: event.publicationStatus, attempted: "restore" });
  }

  return ok({ eventId: event.id, slug: event.slug, restoredTo: target });
}

import "server-only";

import type { PublicationStatus, PublishRequestStatus } from "@/generated/prisma/enums";
import type { SessionUser } from "@/server/auth";
import * as events from "@/server/repositories/event-repository";
import * as requests from "@/server/repositories/publish-request-repository";
import { listSnapshotsForEvent } from "@/server/repositories/snapshot-repository";
import { findUserIdsMatching } from "@/server/repositories/user-repository";
import { canRestore, canSuspend } from "@/server/services/publish-rules";
import { err, ok, type Result } from "@/server/services/result";

/**
 * The admin events index and detail view (task 7.6, FR-43).
 *
 * Kept apart from `review-service.ts` because the two answer different
 * questions: review is "should this submission go live", this is "what is the
 * history of this event and who owns it". They share the admin gate and nothing
 * else — and a reviewer working the queue should not have to load an index's
 * worth of data to make one decision.
 */

function requireAdminRole(user: SessionUser): Result<SessionUser> {
  return user.role === "ADMIN" ? ok(user) : err({ type: "FORBIDDEN", reason: "admin only" });
}

export interface AdminEventRow {
  id: string;
  slug: string;
  displayName: string;
  publicationStatus: PublicationStatus;
  deleted: boolean;
  owner: { email: string; name: string | null };
  updatedAt: Date;
  /** So the index can link straight into the queue for events awaiting review. */
  pendingRequestId: string | null;
}

export interface AdminEventSearch {
  search?: string;
  includeDeleted?: boolean;
}

/**
 * FR-43: search by slug or owner.
 *
 * One box, three matches — slug, display name, and owner email/name — because
 * an admin acting on a report has whatever the reporter gave them, which is
 * usually a URL but is sometimes an email address. Making them choose a field
 * first would be a worse version of trying all three.
 *
 * The owner lookup is a separate query whose ids are OR'd into the event query
 * (see `searchEvents`); it is capped, so searching a common domain returns a
 * usable page rather than the whole table.
 */
export async function searchEvents(
  user: SessionUser,
  query: AdminEventSearch = {},
): Promise<Result<AdminEventRow[]>> {
  const auth = requireAdminRole(user);
  if (!auth.ok) return auth;

  const search = query.search?.trim();
  const ownerIds = search ? await findUserIdsMatching(search) : [];

  const rows = await events.searchEvents({
    search,
    ownerIds,
    includeDeleted: query.includeDeleted ?? false,
  });

  return ok(
    rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      displayName: row.displayName,
      publicationStatus: row.publicationStatus,
      deleted: row.deletedAt !== null,
      owner: { email: row.owner.email, name: row.owner.name.trim() || null },
      updatedAt: row.updatedAt,
      pendingRequestId: row.publishRequests[0]?.id ?? null,
    })),
  );
}

export interface AdminEventDetail {
  event: {
    id: string;
    slug: string;
    displayName: string;
    templateId: string;
    publicationStatus: PublicationStatus;
    deleted: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  owner: { id: string; email: string; name: string | null; createdAt: Date };
  /** BR-16: the attestation an admin verifies by hand in V1. */
  licensing: {
    tedEventUrl: string;
    licenseHolderName: string;
    authorizationConfirmedAt: Date;
  };
  /** BR-8: every request, newest first — rejected and superseded included. */
  history: Array<{
    id: string;
    status: PublishRequestStatus;
    submittedAt: Date;
    reviewedAt: Date | null;
    rejectionReason: string | null;
    snapshotId: string;
  }>;
  /** BR-8: every snapshot ever taken, which is the audit trail proper. */
  snapshots: Array<{
    id: string;
    schemaVersion: number;
    createdAt: Date;
    isLive: boolean;
  }>;
  canSuspend: boolean;
  canRestore: boolean;
}

/**
 * One event's complete administrative record (FR-43).
 *
 * Deliberately readable for a soft-deleted event. FR-13 retains those rows so
 * an admin can answer for what was published; a detail view that refused to
 * open them would make the retention decorative.
 */
export async function getEventDetail(
  user: SessionUser,
  eventId: string,
): Promise<Result<AdminEventDetail>> {
  const auth = requireAdminRole(user);
  if (!auth.ok) return auth;

  const event = await events.findEventForAdmin(eventId);
  if (event === null) return err({ type: "NOT_FOUND", resource: "event" });

  const [history, snapshots] = await Promise.all([
    requests.listRequestsForEvent(eventId),
    listSnapshotsForEvent(eventId),
  ]);

  const state = {
    publicationStatus: event.publicationStatus,
    hasLiveSnapshot: event.liveSnapshotId !== null,
    suspendedFromStatus: event.suspendedFromStatus,
  };

  return ok({
    event: {
      id: event.id,
      slug: event.slug,
      displayName: event.displayName,
      templateId: event.templateId,
      publicationStatus: event.publicationStatus,
      deleted: event.deletedAt !== null,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    },
    owner: {
      id: event.owner.id,
      email: event.owner.email,
      name: event.owner.name.trim() || null,
      createdAt: event.owner.createdAt,
    },
    licensing: {
      tedEventUrl: event.tedEventUrl,
      licenseHolderName: event.licenseHolderName,
      authorizationConfirmedAt: event.authorizationConfirmedAt,
    },
    history: history.map((request) => ({
      id: request.id,
      status: request.status,
      submittedAt: request.submittedAt,
      reviewedAt: request.reviewedAt,
      rejectionReason: request.rejectionReason,
      snapshotId: request.snapshotId,
    })),
    snapshots: snapshots.map((snapshot) => ({
      id: snapshot.id,
      schemaVersion: snapshot.schemaVersion,
      createdAt: snapshot.createdAt,
      isLive: snapshot.id === event.liveSnapshotId,
    })),
    // A soft-deleted event offers neither action: there is nothing public to
    // suspend, and restoring one would resurrect a site its owner deleted.
    canSuspend: !event.deletedAt && canSuspend(state),
    canRestore: !event.deletedAt && canRestore(state),
  });
}

/** The queue badge in the admin nav. */
export async function countPendingReviews(user: SessionUser): Promise<Result<number>> {
  const auth = requireAdminRole(user);
  if (!auth.ok) return auth;

  return ok(await requests.countPendingRequests());
}

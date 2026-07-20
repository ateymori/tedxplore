import type { PublishRequestStatus } from "@/generated/prisma/enums";

import { prisma } from "./prisma";

/**
 * Publish-request data access.
 *
 * Every function here maintains one invariant: `pendingEventId` equals
 * `eventId` while the request is PENDING and is NULL in every terminal state.
 * A unique index on that column is what actually enforces BR-9 (one pending
 * request per event) against concurrent submissions.
 *
 * Status is never written directly from outside this module — the transitions
 * below are the only way to change it, so the column and the invariant cannot
 * drift apart.
 */

/**
 * Rejects with a unique-constraint violation (Prisma `P2002`) when the event
 * already has a pending request. Callers should still check first to give a
 * friendly error; this is the backstop for the race between check and insert.
 */
export async function createPublishRequest(eventId: string, snapshotId: string) {
  return prisma.publishRequest.create({
    data: {
      eventId,
      snapshotId,
      status: "PENDING",
      pendingEventId: eventId,
    },
  });
}

export async function findPendingRequest(eventId: string) {
  return prisma.publishRequest.findUnique({
    where: { pendingEventId: eventId },
    include: { snapshot: { select: { id: true, createdAt: true } } },
  });
}

/** The admin review queue, oldest first (FR-43). */
export async function listPendingRequests() {
  return prisma.publishRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { submittedAt: "asc" },
    include: {
      event: { select: { id: true, slug: true, displayName: true, ownerId: true } },
    },
  });
}

type TerminalStatus = Extract<
  PublishRequestStatus,
  "APPROVED" | "REJECTED" | "CANCELED"
>;

/**
 * Moves a pending request to a terminal state, clearing `pendingEventId` in
 * the same statement so the event immediately becomes submittable again.
 *
 * Scoped to `status: "PENDING"` so a double-click or a retried action can't
 * re-resolve an already-decided request; `count === 0` means someone got
 * there first.
 */
async function resolveRequest(
  id: string,
  status: TerminalStatus,
  extra: { reviewerId?: string; rejectionReason?: string } = {},
): Promise<boolean> {
  const { count } = await prisma.publishRequest.updateMany({
    where: { id, status: "PENDING" },
    data: {
      status,
      pendingEventId: null,
      reviewedAt: new Date(),
      ...extra,
    },
  });

  return count > 0;
}

/**
 * FR-32 / BR-7: approval and the live-snapshot swap are one transaction, so
 * the public site never observes a half-applied publish.
 */
export async function approveRequest(
  requestId: string,
  eventId: string,
  snapshotId: string,
  reviewerId: string,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.publishRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: {
        status: "APPROVED",
        pendingEventId: null,
        reviewedAt: new Date(),
        reviewerId,
      },
    });

    if (count === 0) return false;

    await tx.event.update({
      where: { id: eventId },
      data: { liveSnapshotId: snapshotId, publicationStatus: "PUBLISHED" },
    });

    return true;
  });
}

/** FR-33: the reason is required, so it is a required parameter. */
export async function rejectRequest(
  requestId: string,
  reviewerId: string,
  rejectionReason: string,
): Promise<boolean> {
  return resolveRequest(requestId, "REJECTED", { reviewerId, rejectionReason });
}

/** FR-31: the owner withdrawing their own pending request. */
export async function cancelRequest(requestId: string): Promise<boolean> {
  return resolveRequest(requestId, "CANCELED");
}

/** Request history for the admin event detail view (FR-43). */
export async function listRequestsForEvent(eventId: string) {
  return prisma.publishRequest.findMany({
    where: { eventId },
    orderBy: { submittedAt: "desc" },
  });
}

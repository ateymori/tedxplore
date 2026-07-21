import type { MediaKind } from "@/generated/prisma/enums";

import { prisma } from "./prisma";

/**
 * Media data access (FR-23).
 *
 * Two responsibilities, deliberately separate: recording that an asset exists,
 * and pointing a content field at it. They are separate because a `MediaAsset`
 * row *outlives* every reference to it — all inbound foreign keys are
 * `SetNull` — which is what makes the orphan sweep possible and what keeps a
 * published snapshot's image alive after the organizer swaps it in the draft.
 */

export interface RecordMediaInput {
  eventId: string;
  uploaderId: string;
  cloudinaryPublicId: string;
  kind: MediaKind;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Records an uploaded asset.
 *
 * Upsert rather than create: `cloudinaryPublicId` is unique, and a client that
 * retries a confirmation after a dropped response would otherwise hit a
 * constraint violation on an operation that had already succeeded. The upload
 * itself is the thing that happened; recording it twice must be harmless.
 */
export async function recordMediaAsset(data: RecordMediaInput) {
  return prisma.mediaAsset.upsert({
    where: { cloudinaryPublicId: data.cloudinaryPublicId },
    create: data,
    update: {},
    select: { id: true, cloudinaryPublicId: true, width: true, height: true },
  });
}

export async function findMediaAssetByPublicId(publicId: string) {
  return prisma.mediaAsset.findUnique({
    where: { cloudinaryPublicId: publicId },
    select: { id: true, eventId: true },
  });
}

/**
 * Points one content field at a media asset — or at nothing, when `mediaId` is
 * null (the "remove image" path).
 *
 * Every write is scoped by `eventId` as well as row id, the same defence in
 * depth the content repository applies: a mismatched pair affects zero rows
 * rather than one. Returns the event's new `updatedAt` so image changes feed
 * the same concurrency token as every other edit, or `null` when nothing
 * matched.
 */
export async function attachImage(
  eventId: string,
  slot:
    | { kind: "HERO" }
    | { kind: "VENUE" }
    | { kind: "SPEAKER_PHOTO"; rowId: string }
    | { kind: "TEAM_PHOTO"; rowId: string }
    | { kind: "SPONSOR_LOGO"; rowId: string },
  mediaId: string | null,
): Promise<Date | null> {
  return prisma.$transaction(async (tx) => {
    switch (slot.kind) {
      case "HERO": {
        await tx.event.update({ where: { id: eventId }, data: { heroImageId: mediaId } });
        break;
      }
      case "VENUE": {
        await tx.event.update({ where: { id: eventId }, data: { venueImageId: mediaId } });
        break;
      }
      case "SPEAKER_PHOTO": {
        const { count } = await tx.speaker.updateMany({
          where: { id: slot.rowId, eventId },
          data: { photoId: mediaId },
        });
        if (count === 0) return null;
        break;
      }
      case "TEAM_PHOTO": {
        const { count } = await tx.teamMember.updateMany({
          where: { id: slot.rowId, eventId },
          data: { photoId: mediaId },
        });
        if (count === 0) return null;
        break;
      }
      case "SPONSOR_LOGO": {
        const { count } = await tx.sponsor.updateMany({
          where: { id: slot.rowId, eventId },
          data: { logoId: mediaId },
        });
        if (count === 0) return null;
        break;
      }
    }

    // Same reason as the content repository's `touchEvent`: an explicit
    // timestamp, because Prisma elides an update with nothing to set.
    const { updatedAt } = await tx.event.update({
      where: { id: eventId },
      data: { updatedAt: new Date() },
      select: { updatedAt: true },
    });

    return updatedAt;
  });
}

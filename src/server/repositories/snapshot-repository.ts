import type { EventContent } from "@/content/event-content";
import { eventContentSchema } from "@/content/event-content";
import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "./prisma";

/**
 * Snapshot data access.
 *
 * BR-8: snapshots are append-only. There is deliberately no `update` or
 * `delete` function in this module — the absence is the enforcement. Anything
 * that needs different content creates a new snapshot.
 */

export async function createSnapshot(eventId: string, content: EventContent) {
  return prisma.snapshot.create({
    data: {
      eventId,
      schemaVersion: content.schemaVersion,
      content: content as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * Reads a snapshot's content back.
 *
 * Re-validates on the way out rather than trusting the column: the row may
 * have been written by an older deployment, and a `Json` column carries no
 * type guarantees. From Phase 8 this is where the schema-version upgrader
 * hooks in — old snapshots get migrated forward in code here, so they keep
 * rendering after `EventContent` changes.
 */
export async function findSnapshotContent(id: string): Promise<EventContent | null> {
  const snapshot = await prisma.snapshot.findUnique({ where: { id } });
  if (snapshot === null) return null;

  return eventContentSchema.parse(snapshot.content);
}

/** The live site's source (FR-28), or `null` when nothing is published. */
export async function findLiveContentBySlug(slug: string): Promise<EventContent | null> {
  const event = await prisma.event.findFirst({
    where: { slug, deletedAt: null, publicationStatus: "PUBLISHED" },
    select: { liveSnapshot: true },
  });

  if (event?.liveSnapshot == null) return null;

  return eventContentSchema.parse(event.liveSnapshot.content);
}

/** Publication history for the admin event detail view (FR-43). */
export async function listSnapshotsForEvent(eventId: string) {
  return prisma.snapshot.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    select: { id: true, schemaVersion: true, createdAt: true },
  });
}

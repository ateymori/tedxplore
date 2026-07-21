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

/** Everything the public route needs to render one live site — and nothing more. */
export interface LiveSiteRow {
  templateId: string;
  content: EventContent;
}

/**
 * The live site's source (FR-28), or `null` when nothing is published.
 *
 * The `where` clause is the whole of FR-42: soft-deleted, never-published,
 * unpublished, and suspended events all fail to match, and the caller cannot
 * tell which — the four states are one outcome by construction rather than by
 * a branch someone has to remember to collapse.
 *
 * `liveSnapshot` is checked separately because it is nullable independently of
 * the status: `onDelete: SetNull` means a snapshot row disappearing would
 * leave a PUBLISHED event pointing at nothing. That should be impossible
 * (snapshots are append-only, BR-8), so it is treated as "not live" rather
 * than thrown — a public URL is the wrong place to surface a data-integrity
 * bug.
 */
export async function findLiveSiteBySlug(slug: string): Promise<LiveSiteRow | null> {
  const event = await prisma.event.findFirst({
    where: { slug, deletedAt: null, publicationStatus: "PUBLISHED" },
    select: { templateId: true, liveSnapshot: true },
  });

  if (event?.liveSnapshot == null) return null;

  return {
    templateId: event.templateId,
    content: eventContentSchema.parse(event.liveSnapshot.content),
  };
}

/**
 * Every slug that is live right now, for `generateStaticParams` (task 8.1).
 *
 * Ordered so the build's prerender list is stable between runs — an unordered
 * `findMany` would reshuffle the build output for no reason and make deploy
 * diffs unreadable.
 */
export async function listLiveSlugs(): Promise<string[]> {
  const events = await prisma.event.findMany({
    where: { deletedAt: null, publicationStatus: "PUBLISHED", liveSnapshotId: { not: null } },
    select: { slug: true },
    orderBy: { slug: "asc" },
  });

  return events.map((event) => event.slug);
}

/** Publication history for the admin event detail view (FR-43). */
export async function listSnapshotsForEvent(eventId: string) {
  return prisma.snapshot.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    select: { id: true, schemaVersion: true, createdAt: true },
  });
}

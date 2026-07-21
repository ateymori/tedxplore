import type { EventContent } from "@/content/event-content";
import { upgradeSnapshotContent } from "@/content/upgrade";
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
 * Upgraded and re-validated on the way out rather than trusted: the row may
 * have been written by a deployment that no longer exists, and a `Json` column
 * carries no type guarantees. `upgradeSnapshotContent` (task 8.3) migrates an
 * older document forward in code on every read — snapshots are immutable
 * (invariant 3), so they are never rewritten in place.
 */
export async function findSnapshotContent(id: string): Promise<EventContent | null> {
  const snapshot = await prisma.snapshot.findUnique({ where: { id } });
  if (snapshot === null) return null;

  return upgradeSnapshotContent(snapshot.content);
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
    content: upgradeSnapshotContent(event.liveSnapshot.content),
  };
}

export interface LiveSiteSummary {
  slug: string;
  /**
   * When the live snapshot was created — i.e. when this URL last changed for
   * the public.
   *
   * Deliberately not `Event.updatedAt`: that moves on every autosave, and a
   * sitemap claiming a page changed because someone typed in a draft they
   * never submitted is a lie that trains crawlers to ignore the field.
   */
  lastModified: Date;
}

/**
 * Every site that is live right now — the prerender list (task 8.1) and the
 * sitemap (task 8.2) are the same query.
 *
 * Ordered so the build's prerender list is stable between runs; an unordered
 * `findMany` would reshuffle the build output for no reason and make deploy
 * diffs unreadable.
 */
export async function listLiveSites(): Promise<LiveSiteSummary[]> {
  const events = await prisma.event.findMany({
    where: { deletedAt: null, publicationStatus: "PUBLISHED", liveSnapshotId: { not: null } },
    select: { slug: true, liveSnapshot: { select: { createdAt: true } } },
    orderBy: { slug: "asc" },
  });

  return events.flatMap((event) =>
    event.liveSnapshot === null
      ? []
      : [{ slug: event.slug, lastModified: event.liveSnapshot.createdAt }],
  );
}

/** Publication history for the admin event detail view (FR-43). */
export async function listSnapshotsForEvent(eventId: string) {
  return prisma.snapshot.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    select: { id: true, schemaVersion: true, createdAt: true },
  });
}

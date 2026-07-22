import { ORPHANED_MEDIA_GRACE_HOURS } from "@/config/limits";
import { collectImagePublicIds } from "@/content/image-refs";
import { destroyResource } from "@/server/adapters/cloudinary";
import { captureException, logger } from "@/server/logger";
import { deleteMediaAssetById, findOrphanCandidates } from "@/server/repositories/media-repository";
import { listAllSnapshotContents } from "@/server/repositories/snapshot-repository";

/**
 * The orphaned-media sweep (task 10.4), the reclaim path the Phase 5.4 notes
 * always pointed at ("every inbound FK is `SetNull` … the orphan sweep is what
 * reclaims them").
 *
 * An asset is safe to delete only when **both** are true:
 *   1. no draft foreign key points at it (a replaced hero, a removed speaker
 *      photo) — the repository query handles this, plus a grace window so a
 *      just-uploaded asset isn't reaped before its content field is set; and
 *   2. no retained snapshot references its public id in frozen JSON — because a
 *      live or restorable published site is still rendering it, and snapshots
 *      hold no FK the database could enforce.
 *
 * The second check is why this lives in a service and not a single query: it
 * subtracts the snapshot-referenced ids (`collectImagePublicIds`) from the
 * candidates the repository found. If any snapshot fails to parse,
 * `listAllSnapshotContents` throws and the sweep aborts having deleted nothing
 * — the correct failure mode for a destructive operation that could otherwise
 * orphan a live image.
 *
 * Defaults to a dry run. Only `apply: true` touches Cloudinary or the database,
 * which is what makes the CLI safe to point at production and read first.
 */
export interface OrphanSweepResult {
  /** Candidates with no draft FK, past the grace window. */
  scanned: number;
  /** Of those, how many a retained snapshot still references (left untouched). */
  protectedBySnapshot: number;
  /** Truly orphaned assets — deleted when `apply`, otherwise just counted. */
  orphaned: number;
  deleted: number;
  failed: number;
  dryRun: boolean;
}

export async function sweepOrphanedMedia(options?: {
  graceHours?: number;
  apply?: boolean;
}): Promise<OrphanSweepResult> {
  const graceHours = options?.graceHours ?? ORPHANED_MEDIA_GRACE_HOURS;
  const apply = options?.apply ?? false;
  const cutoff = new Date(Date.now() - graceHours * 60 * 60 * 1000);

  const candidates = await findOrphanCandidates(cutoff);

  // Every public id any retained snapshot still points at. Throws on an
  // unparseable snapshot — aborts before deleting anything.
  const referenced = new Set<string>();
  for (const content of await listAllSnapshotContents()) {
    for (const id of collectImagePublicIds(content)) referenced.add(id);
  }

  const orphans = candidates.filter((c) => !referenced.has(c.cloudinaryPublicId));
  const protectedBySnapshot = candidates.length - orphans.length;

  let deleted = 0;
  let failed = 0;

  if (apply) {
    for (const orphan of orphans) {
      try {
        // Cloudinary first, then the row: a destroy of an already-gone asset is
        // a no-op (Cloudinary answers 200 "not found"), so a crash between the
        // two just leaves the row for the next sweep to retry.
        await destroyResource(orphan.cloudinaryPublicId);
        await deleteMediaAssetById(orphan.id);
        deleted += 1;
        logger.info("media.orphan.deleted", {
          mediaId: orphan.id,
          publicId: orphan.cloudinaryPublicId,
          eventId: orphan.eventId,
        });
      } catch (error) {
        failed += 1;
        captureException(error, {
          scope: "media-cleanup",
          mediaId: orphan.id,
          publicId: orphan.cloudinaryPublicId,
        });
      }
    }
  }

  const result: OrphanSweepResult = {
    scanned: candidates.length,
    protectedBySnapshot,
    orphaned: orphans.length,
    deleted,
    failed,
    dryRun: !apply,
  };

  logger.info("media.orphan.sweep", { ...result, graceHours });

  return result;
}

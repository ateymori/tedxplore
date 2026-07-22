/**
 * Orphaned-media cleanup (task 10.4).
 *
 * Reclaims Cloudinary assets and their `MediaAsset` rows once nothing — no
 * draft foreign key and no retained snapshot — references them any more. See
 * `media-cleanup-service.ts` for the safety argument; the short version is that
 * a snapshot-referenced asset is never touched, and an unparseable snapshot
 * aborts the run rather than risk it.
 *
 * Usage:
 *   pnpm exec tsx --tsconfig tsconfig.script.json scripts/cleanup-orphaned-media.ts
 *   pnpm exec tsx --tsconfig tsconfig.script.json scripts/cleanup-orphaned-media.ts --apply
 *
 * Dry run by default — it prints what it *would* delete and changes nothing.
 * Pass `--apply` to actually destroy the assets. `--apply` needs Cloudinary
 * credentials in the environment; a dry run does not.
 */
import "dotenv/config";

import { prisma } from "@/server/repositories/prisma";
import { sweepOrphanedMedia } from "@/server/services/media-cleanup-service";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  const result = await sweepOrphanedMedia({ apply });

  console.log(apply ? "Orphaned-media sweep (applied):" : "Orphaned-media sweep (dry run):");
  console.log(`  candidates (no draft FK, past grace): ${result.scanned}`);
  console.log(`  protected by a snapshot:              ${result.protectedBySnapshot}`);
  console.log(`  orphaned:                             ${result.orphaned}`);
  if (apply) {
    console.log(`  deleted:                              ${result.deleted}`);
    console.log(`  failed:                               ${result.failed}`);
  } else if (result.orphaned > 0) {
    console.log("\n  Re-run with --apply to delete them.");
  }
}

main()
  .catch((error: unknown) => {
    console.error("Orphaned-media sweep failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });

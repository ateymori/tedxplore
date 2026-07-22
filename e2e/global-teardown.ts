import { closeDb, deleteEventsBySlugPrefix } from "./support/db";
import { E2E_SLUG_PREFIX } from "./support/users";

/**
 * Reclaim every event the run created (global teardown).
 *
 * Each test makes events with the shared `eee…` slug prefix; deleting by that
 * prefix cascades to their snapshots, publish requests, speakers, and the rest
 * via the schema's `onDelete: Cascade` relations, so the local dev database
 * doesn't accumulate a live TEDx site per run. The seeded test *accounts* are
 * left in place — they are reused across runs and cost nothing to keep.
 *
 * Best-effort: a failure here must not fail an otherwise green suite, so it is
 * logged rather than thrown.
 */
async function globalTeardown(): Promise<void> {
  try {
    const count = await deleteEventsBySlugPrefix(E2E_SLUG_PREFIX);
    if (count > 0) {
      console.log(`[e2e teardown] Removed ${count} test event(s).`);
    }
  } catch (error) {
    console.warn("[e2e teardown] Could not clean up test events:", error);
  } finally {
    await closeDb();
  }
}

export default globalTeardown;

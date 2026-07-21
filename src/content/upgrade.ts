import type { EventContent } from "./event-content";
import { CURRENT_SCHEMA_VERSION, eventContentSchema } from "./event-content";

/**
 * The snapshot schema-version upgrader (task 8.3).
 *
 * Snapshots are immutable (invariant 3) and retained forever, so a snapshot
 * approved today will still be rendering the live site long after
 * `EventContent` has moved on. Templates only understand the *current* shape.
 * This module is the bridge: it takes whatever JSON a snapshot row holds and
 * returns a document the current schema accepts, or throws loudly.
 *
 * ## Upgrading happens on read, forever — there is no backfill
 *
 * The obvious alternative is a one-off migration rewriting every snapshot into
 * the new shape. That is precisely what invariant 3 forbids: a snapshot is the
 * evidentiary record of what an admin approved, and rewriting it makes the
 * audit trail a record of what we later decided they approved. Snapshots are
 * append-only in the repository too — there is deliberately no `update`.
 *
 * The cost is that every read pays the upgrade. In practice that is one pure
 * function over an already-parsed object, behind the `use cache` entry on the
 * public route, so it runs about as often as a site is republished.
 *
 * ## Why migrations take and return plain JSON
 *
 * A migration is typed against `Record<string, unknown>`, never against
 * `EventContent`. The typed shape describes only *today's* version: a v1→v2
 * migration written against `EventContent` would compile now and silently mean
 * something different the day v3 lands, because its output type would have
 * quietly become v3's shape. Plain JSON in, plain JSON out, and one schema
 * parse at the very end — that is the only arrangement that stays correct as
 * versions accumulate.
 *
 * ## Adding a version
 *
 * Per invariant 2, changing `EventContent` is one change touching the Zod
 * schema, the serializer, the template, and this file together:
 *
 *   1. Bump `CURRENT_SCHEMA_VERSION` and update `eventContentSchema`.
 *   2. Add an entry to `MIGRATIONS` keyed by the version it upgrades *from*.
 *   3. Add a fixture of the old shape to `upgrade.test.ts`. That fixture is
 *      the only thing that will ever prove the migration works — by the time
 *      it runs in production there is no going back to write one.
 *
 * V1 is the current version and needs no migrations, so `MIGRATIONS` is empty.
 * The machinery is here rather than deferred because the day it is needed is
 * the day snapshots already exist in the old shape, and building it then means
 * building it under pressure against data that is already in the ground.
 */

/** Upgrades a document one version forward. Pure; never touches the database. */
type Migration = (content: Record<string, unknown>) => Record<string, unknown>;

/**
 * Keyed by the version each migration upgrades *from* — `MIGRATIONS[1]` turns
 * a v1 document into a v2 one. Keying by source rather than target is what
 * lets the loop below walk the chain without knowing how long it is.
 */
const MIGRATIONS: Record<number, Migration> = {};

/**
 * Thrown when a snapshot cannot be brought to the current shape.
 *
 * A distinct type because the callers differ in what they can do about it: the
 * public route has no recourse and must fail (better a 500 than a site missing
 * half its content), while the admin review screen can name the snapshot in
 * the message. Neither can treat it as user input — it always means a
 * deployment shipped a schema change without the matching migration.
 */
export class SnapshotUpgradeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotUpgradeError";
  }
}

/**
 * Brings a stored snapshot to the current `EventContent` shape.
 *
 * Takes `unknown` because that is honestly what a Prisma `Json` column holds:
 * no type guarantee, possibly written by a deployment that no longer exists.
 */
export function upgradeSnapshotContent(raw: unknown): EventContent {
  const version = readSchemaVersion(raw);

  if (version > CURRENT_SCHEMA_VERSION) {
    // Reachable during a rolling deploy: a new instance writes a v2 snapshot
    // while an old one is still serving. Refusing is the only safe answer —
    // parsing a newer document with an older schema would drop whatever is new
    // about it, and the failure would look like content silently disappearing
    // from a live site rather than like a deploy in progress.
    throw new SnapshotUpgradeError(
      `Snapshot is schemaVersion ${version}, but this deployment understands at most ` +
        `${CURRENT_SCHEMA_VERSION}. This is expected briefly during a rolling deploy; ` +
        `if it persists, an older instance is still serving traffic.`,
    );
  }

  const content = applyMigrations(
    raw as Record<string, unknown>,
    version,
    CURRENT_SCHEMA_VERSION,
    MIGRATIONS,
  );

  const parsed = eventContentSchema.safeParse(content);
  if (!parsed.success) {
    // The document claimed a version we understand and every migration ran, so
    // it should fit. Reaching here means a migration is incomplete or a
    // snapshot was written by something other than the serializer.
    throw new SnapshotUpgradeError(
      `Snapshot claiming schemaVersion ${version} does not match the current EventContent ` +
        `schema after upgrading: ${parsed.error.issues.map(describeIssue).join("; ")}`,
    );
  }

  return parsed.data;
}

/**
 * A non-throwing variant, for callers that would rather render an error than
 * crash — the admin review screen, which can say *which* snapshot is broken.
 */
export function trySnapshotUpgrade(
  raw: unknown,
): { ok: true; content: EventContent } | { ok: false; error: SnapshotUpgradeError } {
  try {
    return { ok: true, content: upgradeSnapshotContent(raw) };
  } catch (error) {
    if (error instanceof SnapshotUpgradeError) return { ok: false, error };
    throw error;
  }
}

/**
 * The version is read from the raw JSON rather than assumed, because it is the
 * one field every version of the document is guaranteed to carry — that is the
 * entire reason `schemaVersion` exists.
 */
function readSchemaVersion(raw: unknown): number {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new SnapshotUpgradeError(
      `Snapshot content is not an object (got ${raw === null ? "null" : typeof raw}).`,
    );
  }

  const version = (raw as Record<string, unknown>).schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new SnapshotUpgradeError(
      `Snapshot content has no usable schemaVersion (got ${JSON.stringify(version)}).`,
    );
  }

  return version;
}

function describeIssue(issue: { path: PropertyKey[]; message: string }): string {
  const path = issue.path.map(String).join(".");
  return path === "" ? issue.message : `${path}: ${issue.message}`;
}

/**
 * Walks the migration chain from one version to another, applying each step in
 * order.
 *
 * Exported — and taking its version bounds and migration table as arguments
 * rather than reading the module's — precisely so it can be tested. At v1 the
 * real table is empty and the real loop never executes, so nothing else in
 * this file could exercise the part that actually has to work. `upgrade.test.ts`
 * drives it with synthetic versions, which proves the machinery *before* a
 * real migration depends on it: a scaffold nobody has run is a scaffold that
 * will not work on the day it is needed.
 */
export function applyMigrations(
  content: Record<string, unknown>,
  fromVersion: number,
  toVersion: number,
  migrations: Record<number, Migration>,
): Record<string, unknown> {
  let current = content;

  for (let from = fromVersion; from < toVersion; from += 1) {
    const migrate = migrations[from];
    if (migrate === undefined) {
      throw new SnapshotUpgradeError(
        `No migration from schemaVersion ${from} to ${from + 1}. ` +
          `Bumping CURRENT_SCHEMA_VERSION requires adding one (see content/upgrade.ts).`,
      );
    }
    current = migrate(current);
  }

  return current;
}

import { Pool } from "pg";

/**
 * Direct database access for the E2E harness.
 *
 * The suite drives the app through the browser, but two things have to happen
 * out of band: provisioning verified test accounts (Better Auth won't issue a
 * session to an unverified email, and no email is deliverable in local dev),
 * and cleaning up the events each run leaves behind.
 *
 * This uses `pg` directly rather than the generated Prisma client on purpose:
 * that client is an ES module, and Playwright's config/setup files run through
 * a CommonJS transform that cannot `require()` it. Raw SQL against a couple of
 * tables is the smaller, more robust dependency here. Table names are the
 * schema's `@@map` values (`user`, `event`); columns are unmapped, so they keep
 * their camelCase identifiers and must be quoted.
 */
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function findUserByEmail(email: string): Promise<{ id: string } | null> {
  const result = await pool.query<{ id: string }>('SELECT id FROM "user" WHERE email = $1', [
    email,
  ]);
  return result.rows[0] ?? null;
}

/** Flip the parts Better Auth won't set for us in dev: verified email + role. */
export async function markVerifiedWithRole(email: string, role: "USER" | "ADMIN"): Promise<void> {
  await pool.query('UPDATE "user" SET "emailVerified" = true, role = $2 WHERE email = $1', [
    email,
    role,
  ]);
}

/**
 * Delete every event whose slug starts with `prefix`. The schema's
 * `onDelete: Cascade` relations remove each event's snapshots, publish
 * requests, speakers, and the rest along with it.
 */
export async function deleteEventsBySlugPrefix(prefix: string): Promise<number> {
  const result = await pool.query('DELETE FROM "event" WHERE slug LIKE $1', [`${prefix}%`]);
  return result.rowCount ?? 0;
}

export async function closeDb(): Promise<void> {
  await pool.end();
}

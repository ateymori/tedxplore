import "server-only";
import { createHmac } from "node:crypto";

import { serverEnv } from "@/config/env";
import { prisma } from "@/server/repositories/prisma";

/**
 * Rate limiting (BR-15, FR-47, tech-stack decision 5).
 *
 * A fixed-window counter in Postgres, behind an interface narrow enough that
 * swapping in Upstash Redis later touches this file and nothing else. V1 has
 * two low-volume limits — report submission, and preview-token guessing in 9.4
 * — and standing up a Redis dependency to serve them would be infrastructure
 * bought well ahead of need.
 *
 * ## Fixed window, not sliding
 *
 * A fixed window lets a caller burst across a boundary: three reports at 10:59
 * and three more at 11:01. A sliding window would prevent that, at the cost of
 * storing every hit rather than a counter. For BR-15 the burst is harmless —
 * the limit exists to stop automated flooding, not to meter a paid API — and
 * six reports an hour from one address is still six, not six thousand.
 */

export interface RateLimitResult {
  /** Whether this attempt is allowed. `false` means the caller should refuse. */
  ok: boolean;
  /** Attempts used in the current window, including this one. */
  used: number;
  /** When the current window closes, so a caller can say "try again after". */
  resetAt: Date;
}

export interface RateLimiter {
  consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;

  /**
   * Whether another attempt would be allowed, *without* recording one.
   *
   * The point is to spend nothing on the check: a fresh subject has no row, so
   * this is a single indexed read and — crucially — no write. It lets a caller
   * short-circuit expensive work (a database lookup, in the preview-guessing
   * case) before deciding whether the attempt is even worth counting, so the
   * `consume` write only ever lands on attempts that got that far.
   */
  peek(key: string, limit: number): Promise<boolean>;
}

/**
 * Hashes a client IP into an opaque, non-reversible key.
 *
 * The raw address is never stored anywhere (`Report.reporterIpHash` says so in
 * the schema), because a report is a record of someone objecting to a site and
 * the address is the one field that could identify them to the people they
 * reported. An HMAC rather than a bare SHA-256: IPv4 is only ~4 billion
 * values, which is a trivially small space to enumerate against an unkeyed
 * digest, so without a secret the "hash" would be reversible by anyone who got
 * the database.
 *
 * Keyed on `BETTER_AUTH_SECRET` with a domain-separation label rather than a
 * dedicated variable, so no deployment can accidentally run without one. The
 * consequence, worth knowing: **rotating that secret resets every rate-limit
 * window and orphans existing report hashes** for correlation purposes. That
 * is an acceptable trade for one fewer required env var — nothing here is a
 * durable record.
 */
export function hashIp(ip: string): string {
  return createHmac("sha256", serverEnv.BETTER_AUTH_SECRET).update(`report-ip:${ip}`).digest("hex");
}

/**
 * The Postgres implementation.
 *
 * ## Why an expired row is treated as absent rather than cleaned up first
 *
 * `consume` deletes the key's own row if it has expired, then upserts. That
 * makes correctness independent of the cleanup sweep entirely: a window that
 * closed an hour ago behaves exactly like one that never existed, whether or
 * not anything has reclaimed the row. Cleanup is only ever about disk.
 *
 * ## The race
 *
 * Two simultaneous first-hits on the same key can both miss the row and both
 * try to create it; one loses on the unique index. That is caught and retried
 * as an increment. Under a genuine flood the retry path is the common one and
 * still converges — worst case a caller gets one extra attempt through, which
 * for a limit of 3/hour is not worth a serializable transaction per request.
 */
class PostgresRateLimiter implements RateLimiter {
  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = new Date();
    const resetAt = new Date(now.getTime() + windowMs);

    // Clear this key's window if it has already closed, so the upsert below
    // starts a fresh one rather than incrementing a stale count.
    await prisma.rateLimitWindow.deleteMany({ where: { key, expiresAt: { lte: now } } });

    const row = await this.upsert(key, resetAt);

    return { ok: row.count <= limit, used: row.count, resetAt: row.expiresAt };
  }

  async peek(key: string, limit: number): Promise<boolean> {
    const row = await prisma.rateLimitWindow.findUnique({ where: { key } });

    // No window, or one that has already closed, is the same as never having
    // attempted — the next `consume` would open a fresh one.
    if (row === null || row.expiresAt <= new Date()) return true;

    // `< limit` rather than `<=` mirrors `consume`'s `<= limit`: after `limit`
    // recorded attempts the count *is* the limit, and the budget is spent.
    return row.count < limit;
  }

  private async upsert(key: string, resetAt: Date) {
    try {
      return await prisma.rateLimitWindow.upsert({
        where: { key },
        create: { key, count: 1, expiresAt: resetAt },
        update: { count: { increment: 1 } },
      });
    } catch {
      // Lost the create race (P2002) — the row exists now, so increment it.
      // Deliberately not narrowed to P2002: any failure here should still end
      // in a counted attempt rather than an uncounted one, and a second
      // failure propagates.
      return prisma.rateLimitWindow.update({
        where: { key },
        data: { count: { increment: 1 } },
      });
    }
  }
}

export const rateLimiter: RateLimiter = new PostgresRateLimiter();

/**
 * Reclaims closed windows.
 *
 * Called opportunistically after a write (fire-and-forget — a failed sweep
 * must never fail the request that triggered it) and, from Phase 10, on a
 * schedule. Bounded per call so one invocation cannot lock a large table.
 */
export async function sweepExpiredRateLimits(limit = 500): Promise<number> {
  const expired = await prisma.rateLimitWindow.findMany({
    where: { expiresAt: { lte: new Date() } },
    select: { id: true },
    take: limit,
  });

  if (expired.length === 0) return 0;

  const { count } = await prisma.rateLimitWindow.deleteMany({
    where: { id: { in: expired.map((row) => row.id) } },
  });

  return count;
}

import "server-only";

import { REPORT_RATE_LIMIT_MAX_PER_HOUR, REPORT_RATE_LIMIT_WINDOW_MS } from "@/config/limits";
import { REPORT_HONEYPOT_FIELD, type ReportSubmission } from "@/lib/validation/report";
import { hashIp, rateLimiter, sweepExpiredRateLimits } from "@/server/adapters/rate-limit";
import { logger } from "@/server/logger";
import { createReport, findLiveEventIdBySlug } from "@/server/repositories/report-repository";

/**
 * Report submission (FR-45..FR-47, BR-15, task 9.2).
 *
 * Like `site-service`, this runs for an anonymous stranger and takes no
 * session — and like it, the interesting decisions are all about what *not* to
 * reveal.
 */

/**
 * The outcome, from the reporter's point of view.
 *
 * Deliberately only two values. "Accepted" covers both a stored report and a
 * discarded one, because the caller must not be able to tell the difference —
 * see `submitReport`.
 */
export type ReportOutcome = { type: "ACCEPTED" } | { type: "RATE_LIMITED"; resetAt: Date };

/**
 * Files a report, or credibly pretends to.
 *
 * ## Why almost everything returns `ACCEPTED`
 *
 * Three inputs cause the report to be dropped without being stored: a filled
 * honeypot (a bot), a slug that is not a live site (a stale tab, or someone
 * probing), and a missing client address. All three return `ACCEPTED`, and
 * that is the security property, not sloppiness:
 *
 *   - Telling a bot its submission was discarded is how it learns to stop
 *     filling the honeypot. Silence is the entire mechanism.
 *   - Answering differently for a slug that resolves and one that doesn't
 *     turns this endpoint into a public oracle for which slugs exist —
 *     including suspended ones, which is exactly what FR-42 spends its effort
 *     concealing on the read path. Conceding it on the write path would make
 *     that effort pointless.
 *
 * Rate limiting is the one honest refusal, because the reporter needs to know
 * their report did *not* land and that retrying immediately is futile.
 *
 * ## Why the rate limit is checked before the slug resolves
 *
 * Otherwise the limiter only protects real sites, and someone hammering
 * nonexistent slugs would get an unbounded number of free database lookups.
 * The key is per-IP-and-slug, so the cost of the limit falls on the address
 * doing the hammering.
 */
export async function submitReport(
  submission: ReportSubmission,
  clientIp: string | null,
): Promise<ReportOutcome> {
  // No address means no way to bound abuse, so the report is dropped rather
  // than counted against a shared bucket — see `clientIpFrom`. Indistinguishable
  // from success, as above.
  if (clientIp === null) return { type: "ACCEPTED" };

  const ipHash = hashIp(clientIp);

  // Keyed on the slug rather than the resolved event id: the id isn't known
  // yet (see above), and BR-15's "per site" is about the URL being reported.
  const limit = await rateLimiter.consume(
    `report:${submission.slug}:${ipHash}`,
    REPORT_RATE_LIMIT_MAX_PER_HOUR,
    REPORT_RATE_LIMIT_WINDOW_MS,
  );

  if (!limit.ok) return { type: "RATE_LIMITED", resetAt: limit.resetAt };

  // The honeypot (FR-47). Checked after the rate limit so a bot burning
  // attempts is still counted, and before the lookup so it costs us nothing.
  if (submission[REPORT_HONEYPOT_FIELD] !== "") return { type: "ACCEPTED" };

  const eventId = await findLiveEventIdBySlug(submission.slug);
  if (eventId === null) return { type: "ACCEPTED" };

  await createReport({
    eventId,
    category: submission.category,
    explanation: submission.explanation,
    reporterEmail: submission.reporterEmail,
    reporterIpHash: ipHash,
  });

  // Opportunistic cleanup (tech-stack decision 5), fire-and-forget: reclaiming
  // closed windows must never fail or delay the report that triggered it, and
  // correctness never depended on it — `consume` treats an expired row as
  // absent regardless.
  void sweepExpiredRateLimits().catch((error: unknown) => {
    logger.warn("ratelimit.sweep.failed", {
      scope: "reports",
      note: "rows will be reclaimed later",
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return { type: "ACCEPTED" };
}

import "server-only";

import type { ReportCategory, ReportStatus, PublicationStatus } from "@/generated/prisma/enums";
import type { SessionUser } from "@/server/auth";
import * as reports from "@/server/repositories/report-repository";
import { err, ok, type Result } from "@/server/services/result";

/**
 * The admin report inbox (FR-43, task 9.3).
 *
 * Separate from `report-service.ts`, which is the anonymous submission path.
 * The two share the `Report` table and nothing else: one runs for a stranger
 * and is built entirely around revealing nothing, the other runs for an admin
 * and is built around showing everything. Merging them would put an
 * authorization branch through the middle of both.
 */

/**
 * Re-checked here even though `/admin` has a layout guard, for the reason the
 * other admin services state: a layout guard protects a *route*, and the day
 * one of these is called from a route handler or a script, the route is not
 * what is protecting it.
 */
function requireAdminRole(user: SessionUser): Result<SessionUser> {
  return user.role === "ADMIN" ? ok(user) : err({ type: "FORBIDDEN", reason: "admin only" });
}

export interface ReportRow {
  id: string;
  category: ReportCategory;
  status: ReportStatus;
  createdAt: Date;
  hasReporterEmail: boolean;
  event: {
    id: string;
    slug: string;
    displayName: string;
    publicationStatus: PublicationStatus;
  };
}

/**
 * The inbox list.
 *
 * Reports the *presence* of a reporter email rather than the address itself.
 * The list is a triage screen — knowing a report is followable-up is what
 * changes which one you open, the address is not — and an address that only
 * appears on the detail page is one that cannot be shoulder-surfed off a
 * screen someone left open on the inbox.
 */
export async function listReports(
  user: SessionUser,
  options: { status?: ReportStatus } = {},
): Promise<Result<ReportRow[]>> {
  const auth = requireAdminRole(user);
  if (!auth.ok) return auth;

  const rows = await reports.listReports(options);

  return ok(
    rows.map((row) => ({
      id: row.id,
      category: row.category,
      status: row.status,
      createdAt: row.createdAt,
      hasReporterEmail: row.reporterEmail !== null,
      event: row.event,
    })),
  );
}

export async function countOpenReports(user: SessionUser): Promise<Result<number>> {
  const auth = requireAdminRole(user);
  if (!auth.ok) return auth;

  return ok(await reports.countOpenReports());
}

export interface ReportDetail {
  id: string;
  category: ReportCategory;
  explanation: string;
  reporterEmail: string | null;
  status: ReportStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  resolver: { email: string; name: string | null } | null;
  event: {
    id: string;
    slug: string;
    displayName: string;
    publicationStatus: PublicationStatus;
    deleted: boolean;
    owner: { email: string; name: string | null };
  };
}

export async function getReportDetail(
  user: SessionUser,
  reportId: string,
): Promise<Result<ReportDetail>> {
  const auth = requireAdminRole(user);
  if (!auth.ok) return auth;

  const report = await reports.findReportById(reportId);
  if (report === null) return err({ type: "NOT_FOUND", resource: "report" });

  return ok({
    id: report.id,
    category: report.category,
    explanation: report.explanation,
    reporterEmail: report.reporterEmail,
    status: report.status,
    createdAt: report.createdAt,
    resolvedAt: report.resolvedAt,
    resolver:
      report.resolver === null
        ? null
        : { email: report.resolver.email, name: report.resolver.name?.trim() || null },
    event: {
      id: report.event.id,
      slug: report.event.slug,
      displayName: report.event.displayName,
      publicationStatus: report.event.publicationStatus,
      deleted: report.event.deletedAt !== null,
      owner: {
        email: report.event.owner.email,
        name: report.event.owner.name?.trim() || null,
      },
    },
  });
}

/**
 * Closes a report as acted-on or as nothing-to-do.
 *
 * The distinction is recorded rather than collapsed into "closed" because the
 * two mean opposite things about the *site*: a resolved report is evidence
 * something was wrong with it, a dismissed one is evidence it was fine. An
 * admin looking at a site with a history of reports needs to be able to tell
 * "reported five times and acted on once" from "reported five times, all
 * nonsense" — and that is the difference between a bad actor and a popular
 * target.
 *
 * Deliberately does **not** suspend anything. Suspension is a separate,
 * heavier act with its own confirmation and its own email (BR-10, task 7.5);
 * bundling it into "resolve" would make the fast path through the inbox also
 * the path that takes someone's site offline. The detail page links to the
 * event where that action lives.
 *
 * `INVALID_STATE` on an already-closed report: two admins working the inbox
 * would otherwise have the second silently overwrite the first's decision, and
 * a report reopening as someone else's is worse than a refusal.
 */
export async function closeReport(
  user: SessionUser,
  reportId: string,
  status: "RESOLVED" | "DISMISSED",
): Promise<Result<{ reportId: string }>> {
  const auth = requireAdminRole(user);
  if (!auth.ok) return auth;

  const report = await reports.findReportById(reportId);
  if (report === null) return err({ type: "NOT_FOUND", resource: "report" });

  // The pre-check is UX — it produces the specific message. The guarded write
  // below is the enforcement, and it is what actually closes the race.
  if (report.status !== "OPEN") {
    return err({ type: "INVALID_STATE", current: report.status, attempted: status });
  }

  const closed = await reports.closeReport(reportId, status, user.id);
  if (!closed) {
    return err({ type: "INVALID_STATE", current: "RESOLVED", attempted: status });
  }

  return ok({ reportId });
}

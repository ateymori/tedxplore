import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { adminReportPath } from "@/config/routes";
import { formatRelativeTime } from "@/lib/format";
import { REPORT_CATEGORY_LABELS } from "@/lib/validation/report";
import { requireAdmin } from "@/server/auth-guards";
import { listReports } from "@/server/services/report-admin-service";

export const metadata: Metadata = { title: "Reports" };

/**
 * The report inbox (FR-43, task 9.3).
 *
 * Open reports first, oldest first within that — the same ordering rule as the
 * review queue, for the same reason: a complaint nobody has looked at is the
 * point of the screen, and newest-first lets the oldest one starve.
 *
 * Closed reports stay in the list rather than disappearing. A site's report
 * history is what distinguishes a bad actor from a popular target, and an
 * inbox that empties itself hides exactly that.
 */
export default async function ReportsPage() {
  const admin = await requireAdmin();

  const result = await listReports(admin);
  // Unreachable: the layout guard already established the role. Rendering
  // nothing beats rendering a broken page if that ever stops being true.
  if (!result.ok) return null;

  const reports = result.value;
  const open = reports.filter((report) => report.status === "OPEN");
  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          {reports.length === 0
            ? "No one has reported a site."
            : `${open.length} open of ${reports.length} total, oldest first.`}
        </p>
      </div>

      {reports.length === 0 ? (
        <Empty className="rounded-xl border border-dashed py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldCheck />
            </EmptyMedia>
            <EmptyTitle>Nothing reported</EmptyTitle>
            <EmptyDescription>
              Reports from the &ldquo;Report this site&rdquo; link on published sites appear here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="divide-y rounded-xl border">
          {reports.map((report) => (
            <li key={report.id}>
              <Link
                href={adminReportPath(report.id)}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{report.event.displayName}</span>
                    {report.status === "OPEN" ? (
                      <Badge>Open</Badge>
                    ) : (
                      <Badge variant="secondary">
                        {report.status === "RESOLVED" ? "Resolved" : "Dismissed"}
                      </Badge>
                    )}
                    {report.event.publicationStatus === "SUSPENDED" ? (
                      <Badge variant="destructive">Suspended</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {REPORT_CATEGORY_LABELS[report.category]}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                  {/*
                    Presence, not the address itself (see `listReports`): whether
                    a report can be followed up changes which one you open; the
                    address does not, and it does not belong on a triage screen.
                  */}
                  {report.hasReporterEmail ? (
                    <Mail className="size-4" aria-label="Reporter left an email address" />
                  ) : null}
                  <span>{formatRelativeTime(report.createdAt, now)}</span>
                  <ArrowRight className="size-4" aria-hidden="true" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

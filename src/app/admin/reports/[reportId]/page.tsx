import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ADMIN_REPORTS_PATH, adminEventPath } from "@/config/routes";
import { tedxSitePath } from "@/config/site";
import { formatDateTime } from "@/lib/format";
import { REPORT_CATEGORY_LABELS } from "@/lib/validation/report";
import { requireAdmin } from "@/server/auth-guards";
import { getReportDetail } from "@/server/services/report-admin-service";
import { CloseReportButtons } from "./close-report-buttons";

export const metadata: Metadata = { title: "Report" };

/**
 * One report (FR-43, task 9.3).
 *
 * The screen an admin decides on, so it carries the three things a decision
 * needs and nothing else: what was said, what the site currently is, and the
 * two ways to close it. The reporter's email appears here and only here.
 *
 * Suspension is a *link* to the event page, not an action on this page. That
 * is deliberate: acting on a report and taking a site offline are different
 * decisions with different weights, and the second one needs the whole event
 * — owner, licensing, publication history — in front of you, which is exactly
 * what the event page shows. Putting a suspend button here would invite
 * suspending on the strength of one stranger's paragraph.
 */
export default async function ReportDetailPage({ params }: PageProps<"/admin/reports/[reportId]">) {
  const admin = await requireAdmin();
  const { reportId } = await params;

  const result = await getReportDetail(admin, reportId);
  if (!result.ok) notFound();

  const report = result.value;
  const { event } = report;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={ADMIN_REPORTS_PATH}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          All reports
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {REPORT_CATEGORY_LABELS[report.category]}
          </h1>
          {report.status === "OPEN" ? (
            <Badge>Open</Badge>
          ) : (
            <Badge variant="secondary">
              {report.status === "RESOLVED" ? "Resolved" : "Dismissed"}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Reported {formatDateTime(report.createdAt)}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-8">
          <section className="rounded-xl border p-6">
            <h2 className="text-sm font-medium text-muted-foreground">What was reported</h2>
            {/* `whitespace-pre-line` so the reporter's paragraphs survive. */}
            <p className="mt-3 leading-relaxed whitespace-pre-line">{report.explanation}</p>

            <div className="mt-6 border-t pt-4 text-sm">
              <span className="text-muted-foreground">Reporter: </span>
              {report.reporterEmail === null ? (
                <span className="text-muted-foreground">
                  no email left — there is no way to follow up
                </span>
              ) : (
                <a href={`mailto:${report.reporterEmail}`} className="underline underline-offset-4">
                  {report.reporterEmail}
                </a>
              )}
            </div>
          </section>

          {report.status === "OPEN" ? (
            <section className="rounded-xl border p-6">
              <h2 className="text-sm font-medium text-muted-foreground">Close this report</h2>
              <div className="mt-4">
                <CloseReportButtons reportId={report.id} />
              </div>
            </section>
          ) : (
            <section className="rounded-xl border p-6">
              <h2 className="text-sm font-medium text-muted-foreground">Already closed</h2>
              <p className="mt-3 text-sm">
                {report.status === "RESOLVED" ? "Resolved" : "Dismissed"}
                {report.resolvedAt === null ? null : ` on ${formatDateTime(report.resolvedAt)}`}
                {report.resolver === null ? null : ` by ${report.resolver.email}`}.
              </p>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <section className="rounded-xl border p-6">
            <h2 className="text-sm font-medium text-muted-foreground">The site</h2>

            <p className="mt-3 font-medium">{event.displayName}</p>
            <p className="font-mono text-xs text-muted-foreground">{tedxSitePath(event.slug)}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge
                variant={event.publicationStatus === "SUSPENDED" ? "destructive" : "secondary"}
              >
                {STATUS_LABELS[event.publicationStatus]}
              </Badge>
              {event.deleted ? <Badge variant="destructive">Deleted</Badge> : null}
            </div>

            <div className="mt-6 flex flex-col gap-2">
              {/*
                Only offered while the site is actually reachable. A link
                promising to open a suspended or unpublished site lands on the
                branded 404, which reads as a broken admin tool rather than as
                the site being correctly dark.
              */}
              {event.publicationStatus === "PUBLISHED" && !event.deleted ? (
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={
                    <a href={tedxSitePath(event.slug)} target="_blank" rel="noopener noreferrer" />
                  }
                >
                  View the live site
                  <ExternalLink className="size-4" aria-hidden="true" />
                </Button>
              ) : null}

              {/*
                Where suspension lives (FR-44). A link rather than an action —
                see this file's header for why.
              */}
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={adminEventPath(event.id)} />}
              >
                Open event &amp; moderation
              </Button>
            </div>
          </section>

          <section className="rounded-xl border p-6">
            <h2 className="text-sm font-medium text-muted-foreground">Owner</h2>
            <p className="mt-3 text-sm">{event.owner.name ?? "—"}</p>
            <p className="text-sm text-muted-foreground">{event.owner.email}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

const STATUS_LABELS = {
  NEVER_PUBLISHED: "Draft",
  PUBLISHED: "Live",
  UNPUBLISHED: "Unpublished",
  SUSPENDED: "Suspended",
} as const;

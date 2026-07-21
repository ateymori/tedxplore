import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";

import { ReviewDecisionBar } from "@/components/admin/review-decision-bar";
import { ReviewSnapshotFrame } from "@/components/admin/review-snapshot-frame";
import { Badge } from "@/components/ui/badge";
import { PublicationStatusBadge } from "@/components/events/event-status";
import { adminEventPath, REVIEW_QUEUE_PATH } from "@/config/routes";
import { tedxSitePath } from "@/config/site";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/server/auth-guards";
import type { ReviewDetail } from "@/server/services/review-service";
import { getReviewDetail } from "@/server/services/review-service";

export const metadata: Metadata = { title: "Review submission" };

/**
 * One publish request, rendered for a decision (task 7.2, FR-43).
 *
 * The page is built around a single guarantee: **what is shown is exactly what
 * would go live**. The snapshot's frozen `EventContent` goes through the real
 * template — not a re-serialization of the draft, which by now may have moved
 * on, since FR-31 lets the owner keep editing while the request is pending.
 * Reviewing one document and approving another is the failure this screen
 * exists to prevent, so the content comes from the snapshot and nowhere else.
 *
 * The licensing panel sits above the site rather than below it because BR-16 is
 * the check a human actually has to perform: the rendered page tells you
 * whether the site is presentable, and only the TED URL and license holder tell
 * you whether it is *allowed*.
 */
export default async function ReviewRequestPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const admin = await requireAdmin();
  const { requestId } = await params;

  const result = await getReviewDetail(admin, requestId);
  if (!result.ok) notFound();

  const detail = result.value;
  const decided = detail.status !== "PENDING";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={REVIEW_QUEUE_PATH}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to the queue
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-semibold tracking-tight">
                {detail.event.displayName}
              </h1>
              <PublicationStatusBadge status={detail.event.publicationStatus} />
              {detail.event.deleted ? <Badge variant="destructive">Deleted</Badge> : null}
              {decided ? <Badge variant="outline">{decisionLabel(detail.status)}</Badge> : null}
            </div>
            <p className="font-mono text-sm text-muted-foreground">
              {tedxSitePath(detail.event.slug)}
            </p>
          </div>

          <Link
            href={adminEventPath(detail.event.id)}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Full history
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="order-2 flex flex-col gap-4 lg:order-1">
          <ReviewSnapshotFrame
            templateId={detail.event.templateId}
            content={detail.content}
            displayName={detail.event.displayName}
            pending={!decided}
          />
        </div>

        <aside className="order-1 flex flex-col gap-4 lg:sticky lg:top-6 lg:order-2">
          {detail.status === "PENDING" ? (
            <ReviewDecisionBar
              requestId={detail.requestId}
              eventName={detail.event.displayName}
              firstPublication={detail.event.publicationStatus === "NEVER_PUBLISHED"}
            />
          ) : (
            <DecidedNotice detail={detail} />
          )}

          <LicensingPanel detail={detail} />
          <SubmissionPanel detail={detail} />
        </aside>
      </div>
    </div>
  );
}

function decisionLabel(status: string): string {
  switch (status) {
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "CANCELED":
      return "Cancelled by owner";
    default:
      return status;
  }
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      <dl className="flex flex-col gap-2 text-sm">{children}</dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

/**
 * BR-16, the check a human performs by hand in V1.
 *
 * The TED URL opens in a new tab with `rel="noopener noreferrer"` — it is
 * user-supplied and external like any other link in the product, and an admin
 * being the one to click it makes that more worth being careful about, not less.
 */
function LicensingPanel({ detail }: { detail: ReviewDetail }) {
  return (
    <Panel title="Licensing (BR-16)">
      <Row label="Official TED event page">
        <a
          href={detail.licensing.tedEventUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline underline-offset-4"
        >
          <span className="break-all">{detail.licensing.tedEventUrl}</span>
          <ExternalLink className="size-3 shrink-0" aria-hidden />
        </a>
      </Row>
      <Row label="License holder">{detail.licensing.licenseHolderName}</Row>
      <Row label="Authorization confirmed">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          {formatDateTime(detail.licensing.authorizationConfirmedAt)}
        </span>
      </Row>
    </Panel>
  );
}

function SubmissionPanel({ detail }: { detail: ReviewDetail }) {
  return (
    <Panel title="Submission">
      <Row label="Submitted">{formatDateTime(detail.submittedAt)}</Row>
      <Row label="Owner">
        <span className="flex flex-col">
          {detail.owner.name === null ? null : <span>{detail.owner.name}</span>}
          <span className="text-muted-foreground">{detail.owner.email}</span>
        </span>
      </Row>
      <Row label="Account created">{formatDateTime(detail.owner.createdAt)}</Row>
      <Row label="Template">{detail.event.templateId}</Row>
      {detail.isLive ? <Row label="Note">This snapshot is the one currently live.</Row> : null}
    </Panel>
  );
}

/**
 * What happened to a request that is no longer pending.
 *
 * Reachable by opening a queue link that someone else already decided, or by
 * navigating back to one. Showing the decision — rather than a 404 or a bare
 * disabled bar — is what makes a double-click land somewhere sensible.
 */
function DecidedNotice({ detail }: { detail: ReviewDetail }) {
  return (
    <Panel title="Already decided">
      <Row label="Outcome">{decisionLabel(detail.status)}</Row>
      {detail.reviewedAt === null ? null : (
        <Row label="Reviewed">{formatDateTime(detail.reviewedAt)}</Row>
      )}
      {detail.reviewer === null ? null : <Row label="Reviewer">{detail.reviewer.email}</Row>}
      {detail.rejectionReason === null ? null : (
        <Row label="Reason given">
          {/* Reviewer-authored free text: rendered as text, line breaks kept. */}
          <span className="whitespace-pre-wrap">{detail.rejectionReason}</span>
        </Row>
      )}
    </Panel>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";

import { SuspensionControls } from "@/components/admin/suspension-controls";
import { Badge } from "@/components/ui/badge";
import { PublicationStatusBadge } from "@/components/events/event-status";
import { ADMIN_EVENTS_PATH, reviewRequestPath } from "@/config/routes";
import { tedxSitePath, tedxSiteUrl } from "@/config/site";
import { formatDateTime } from "@/lib/format";
import type { PublishRequestStatus } from "@/generated/prisma/enums";
import { requireAdmin } from "@/server/auth-guards";
import { getEventDetail } from "@/server/services/admin-service";

export const metadata: Metadata = { title: "Event" };

/**
 * One event's complete administrative record (task 7.6, FR-43).
 *
 * This is the page an admin opens when answering for something — a report, a
 * licensing question, "why is this site down". So it shows the things nothing
 * else does: the ownership and licensing attestation, every publish request
 * including the rejected and cancelled ones, and every snapshot ever taken
 * (BR-8 retains all of them precisely so this view can exist).
 *
 * It opens for soft-deleted events too. Retention under FR-13 is what makes
 * that possible and this is the view it exists for.
 */
export default async function AdminEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const admin = await requireAdmin();
  const { eventId } = await params;

  const result = await getEventDetail(admin, eventId);
  if (!result.ok) notFound();

  const { event, owner, licensing, history, snapshots, canSuspend, canRestore } = result.value;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={ADMIN_EVENTS_PATH}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          All events
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{event.displayName}</h1>
          <PublicationStatusBadge status={event.publicationStatus} />
          {event.deleted ? <Badge variant="destructive">Deleted</Badge> : null}
        </div>

        <p className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
          {tedxSitePath(event.slug)}
          {event.publicationStatus === "PUBLISHED" && !event.deleted ? (
            <a
              href={tedxSiteUrl(event.slug)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open the live site"
            >
              <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <aside className="flex flex-col gap-4">
          <SuspensionControls
            eventId={event.id}
            eventName={event.displayName}
            canSuspend={canSuspend}
            canRestore={canRestore}
          />

          <Panel title="Owner">
            <Row label="Email">{owner.email}</Row>
            {owner.name === null ? null : <Row label="Name">{owner.name}</Row>}
            <Row label="Account created">{formatDateTime(owner.createdAt)}</Row>
          </Panel>

          <Panel title="Licensing (BR-16)">
            <Row label="Official TED event page">
              <a
                href={licensing.tedEventUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-4"
              >
                <span className="break-all">{licensing.tedEventUrl}</span>
                <ExternalLink className="size-3 shrink-0" aria-hidden />
              </a>
            </Row>
            <Row label="License holder">{licensing.licenseHolderName}</Row>
            <Row label="Authorization confirmed">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                {formatDateTime(licensing.authorizationConfirmedAt)}
              </span>
            </Row>
          </Panel>

          <Panel title="Event">
            <Row label="Template">{event.templateId}</Row>
            <Row label="Created">{formatDateTime(event.createdAt)}</Row>
            <Row label="Last edited">{formatDateTime(event.updatedAt)}</Row>
          </Panel>
        </aside>

        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">
              Publish requests{" "}
              <span className="text-sm font-normal text-muted-foreground">({history.length})</span>
            </h2>

            {history.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                This event has never been submitted for review.
              </p>
            ) : (
              <ul className="flex flex-col divide-y rounded-xl border bg-card">
                {history.map((request) => (
                  <li key={request.id} className="flex flex-col gap-1.5 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <RequestStatusBadge status={request.status} />
                      <Link
                        href={reviewRequestPath(request.id)}
                        className="underline-offset-4 hover:underline"
                      >
                        Submitted {formatDateTime(request.submittedAt)}
                      </Link>
                      {request.reviewedAt === null ? null : (
                        <span className="text-xs text-muted-foreground">
                          · decided {formatDateTime(request.reviewedAt)}
                        </span>
                      )}
                    </div>

                    {request.rejectionReason === null ? null : (
                      <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                        {request.rejectionReason}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">
              Snapshots{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({snapshots.length})
              </span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Every submission freezes a snapshot, and none is ever modified or removed (BR-8).
            </p>

            {snapshots.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                No snapshots yet.
              </p>
            ) : (
              <ul className="flex flex-col divide-y rounded-xl border bg-card">
                {snapshots.map((snapshot) => (
                  <li
                    key={snapshot.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm"
                  >
                    <span className="font-mono text-xs text-muted-foreground">{snapshot.id}</span>
                    {snapshot.isLive ? <Badge>Live</Badge> : null}
                    <span className="ml-auto text-xs text-muted-foreground">
                      schema v{snapshot.schemaVersion} · {formatDateTime(snapshot.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
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

/** Exhaustive, so a new request status can't ship without a label here. */
function RequestStatusBadge({ status }: { status: PublishRequestStatus }) {
  switch (status) {
    case "PENDING":
      return <Badge variant="secondary">Pending</Badge>;
    case "APPROVED":
      return <Badge>Approved</Badge>;
    case "REJECTED":
      return <Badge variant="destructive">Rejected</Badge>;
    case "CANCELED":
      return <Badge variant="outline">Cancelled</Badge>;
  }
}

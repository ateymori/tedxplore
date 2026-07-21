import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Inbox, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { reviewRequestPath } from "@/config/routes";
import { tedxSitePath } from "@/config/site";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { requireAdmin } from "@/server/auth-guards";
import { listReviewQueue } from "@/server/services/review-service";

export const metadata: Metadata = { title: "Review queue" };

/**
 * The admin review queue (task 7.2, FR-43).
 *
 * The landing page of the admin area, because it is the only part of it with a
 * backlog: everything else is looked up on demand, this is work waiting to be
 * done. Oldest first (the repository's ordering) so submissions cannot starve.
 *
 * Each row is deliberately terse. The decision needs the whole rendered site,
 * which is a page in itself — the queue's job is only to let a reviewer pick
 * the next one and see whether it is a first publication or a re-review.
 */
export default async function ReviewQueuePage() {
  const admin = await requireAdmin();

  const queue = await listReviewQueue(admin);
  // Unreachable: the layout guard already established the role. Rendering
  // nothing beats rendering a broken page if that ever stops being true.
  if (!queue.ok) return null;

  const requests = queue.value;
  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Review queue</h1>
        <p className="text-sm text-muted-foreground">
          {requests.length === 0
            ? "Nothing is waiting for review."
            : `${requests.length} ${requests.length === 1 ? "submission" : "submissions"} waiting, oldest first.`}
        </p>
      </div>

      {requests.length === 0 ? (
        <Empty className="rounded-xl border border-dashed py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>The queue is empty</EmptyTitle>
            <EmptyDescription>
              Submissions appear here as organizers send their sites for review.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((request) => (
            <li key={request.requestId}>
              <Link
                href={reviewRequestPath(request.requestId)}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-accent/40"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{request.event.displayName}</span>
                    {request.resubmission ? (
                      <Badge variant="secondary">
                        <RefreshCw className="size-3" aria-hidden />
                        Re-review
                      </Badge>
                    ) : (
                      <Badge variant="outline">First publication</Badge>
                    )}
                  </div>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {tedxSitePath(request.event.slug)}
                  </p>
                </div>

                <div className="flex flex-col gap-0.5 text-sm">
                  <span className="text-muted-foreground">{request.owner.email}</span>
                  {/* Both forms: relative is what a reviewer triages on, exact
                      is what they quote when replying to an organizer. */}
                  <span
                    className="text-xs text-muted-foreground"
                    title={formatDateTime(request.submittedAt)}
                  >
                    Submitted {formatRelativeTime(request.submittedAt, now)}
                  </span>
                </div>

                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

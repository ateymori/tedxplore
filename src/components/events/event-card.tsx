import Link from "next/link";
import { ExternalLink, Eye, Pencil, Settings } from "lucide-react";

import { DeleteEventDialog } from "@/components/events/delete-event-dialog";
import { PublicationStatusBadge, ReviewStatusBadge } from "@/components/events/event-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { eventPath, eventPreviewPath, eventSettingsPath } from "@/config/routes";
import { tedxSitePath } from "@/config/site";
import type { PublicationStatus, PublishRequestStatus } from "@/generated/prisma/enums";
import { formatRelativeTime } from "@/lib/format";

/**
 * One event on the dashboard (FR-11, FR-12).
 *
 * A server component: everything on it is already loaded, and the only
 * interactive part is the delete dialog, which is its own client island.
 */

export interface EventCardData {
  id: string;
  slug: string;
  displayName: string;
  publicationStatus: PublicationStatus;
  updatedAt: Date;
  latestRequest: { status: PublishRequestStatus; rejectionReason: string | null } | null;
}

export function EventCard({ event, now }: { event: EventCardData; now: Date }) {
  const sitePath = tedxSitePath(event.slug);
  const isLive = event.publicationStatus === "PUBLISHED";

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate text-lg font-semibold tracking-tight">
            <Link href={eventPath(event.id)} className="underline-offset-4 hover:underline">
              {event.displayName}
            </Link>
          </h2>

          {/* Live sites link out; everything else shows the address it will
              have, since following it would only reach the unavailable page
              (FR-42). */}
          {isLive ? (
            <a
              href={sitePath}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-fit items-center gap-1 font-mono text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {sitePath}
              <ExternalLink className="size-3" />
            </a>
          ) : (
            <span className="font-mono text-sm text-muted-foreground">{sitePath}</span>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <PublicationStatusBadge status={event.publicationStatus} />
          {event.latestRequest ? <ReviewStatusBadge status={event.latestRequest.status} /> : null}
        </div>
      </div>

      {event.latestRequest?.status === "REJECTED" && event.latestRequest.rejectionReason ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
          <span className="font-medium">Reviewer feedback: </span>
          {event.latestRequest.rejectionReason}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Edited {formatRelativeTime(event.updatedAt, now)}
        </p>

        <div className="flex flex-wrap items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={eventPath(event.id)} />}
          >
            <Pencil />
            Edit content
          </Button>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href={eventPreviewPath(event.id)} target="_blank" rel="noreferrer" />}
          >
            <Eye />
            Preview
          </Button>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href={eventSettingsPath(event.id)} />}
          >
            <Settings />
            Settings
          </Button>
          <DeleteEventDialog
            eventId={event.id}
            displayName={event.displayName}
            slug={event.slug}
            publicationStatus={event.publicationStatus}
          />
        </div>
      </div>
    </Card>
  );
}

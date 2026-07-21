import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { PublicationStatusBadge } from "@/components/events/event-status";
import {
  ADMIN_INCLUDE_DELETED_PARAM,
  ADMIN_SEARCH_PARAM,
  adminEventPath,
  ADMIN_EVENTS_PATH,
  reviewRequestPath,
} from "@/config/routes";
import { tedxSitePath } from "@/config/site";
import { formatRelativeTime } from "@/lib/format";
import { requireAdmin } from "@/server/auth-guards";
import { searchEvents } from "@/server/services/admin-service";

export const metadata: Metadata = { title: "Events" };

/**
 * The admin events index (task 7.6, FR-43).
 *
 * Search is a plain GET form, not a client-side filter: the result is a URL an
 * admin can bookmark, paste into a ticket, or share with another admin looking
 * at the same report. It also means the page works with JavaScript off and
 * needs no loading state at all — the navigation *is* the loading state.
 *
 * `searchParams` is a promise in Next 16.
 */
export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;

  const rawSearch = params[ADMIN_SEARCH_PARAM];
  const search = typeof rawSearch === "string" ? rawSearch : undefined;
  const includeDeleted = params[ADMIN_INCLUDE_DELETED_PARAM] === "1";

  const result = await searchEvents(admin, { search, includeDeleted });
  if (!result.ok) return null;

  const events = result.value;
  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <p className="text-sm text-muted-foreground">
          Search by address, event name, or the owner&rsquo;s email.
        </p>
      </div>

      <form method="get" action={ADMIN_EVENTS_PATH} className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-64 flex-1 items-center gap-2">
          <Input
            type="search"
            name={ADMIN_SEARCH_PARAM}
            defaultValue={search ?? ""}
            placeholder="mcgillu, TEDxMcGill, someone@example.com"
            aria-label="Search events"
          />
          <Button type="submit" variant="outline">
            <Search />
            Search
          </Button>
        </div>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {/* FR-13 keeps soft-deleted events for audit; this is the only view in
              the product that can see them, so it is opt-in rather than default. */}
          <Checkbox name={ADMIN_INCLUDE_DELETED_PARAM} value="1" defaultChecked={includeDeleted} />
          Include deleted
        </label>
      </form>

      {events.length === 0 ? (
        <Empty className="rounded-xl border border-dashed py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>No events found</EmptyTitle>
            <EmptyDescription>
              {search
                ? `Nothing matches “${search}”. Try an address, an event name, or an owner’s email.`
                : "No events exist yet."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={adminEventPath(event.id)}
                    className="truncate font-medium underline-offset-4 hover:underline"
                  >
                    {event.displayName}
                  </Link>
                  <PublicationStatusBadge status={event.publicationStatus} />
                  {event.deleted ? <Badge variant="destructive">Deleted</Badge> : null}
                  {event.pendingRequestId === null ? null : (
                    <Link href={reviewRequestPath(event.pendingRequestId)}>
                      <Badge variant="secondary">In review</Badge>
                    </Link>
                  )}
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {tedxSitePath(event.slug)}
                </p>
              </div>

              <span className="truncate text-muted-foreground">{event.owner.email}</span>
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(event.updatedAt, now)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

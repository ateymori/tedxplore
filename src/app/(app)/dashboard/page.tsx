import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";

import { EventCard } from "@/components/events/event-card";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { NEW_EVENT_PATH } from "@/config/routes";
import { requireUser } from "@/server/auth-guards";
import { listEventCardsByOwner } from "@/server/repositories/event-repository";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * The organizer's event list (FR-11, task 3.2).
 *
 * Reads through the repository directly rather than a service: this is a
 * query, scoped to the session user by the query itself, with no rule to
 * enforce beyond that. A service here would be a pass-through.
 */
export default async function DashboardPage() {
  const user = await requireUser();
  const events = await listEventCardsByOwner(user.id);

  // Pinned once so every card on the page measures "edited N ago" against the
  // same instant.
  const now = new Date();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Your events</h1>
          <p className="text-muted-foreground">
            {events.length === 0
              ? "Create your first TEDx event site."
              : `${events.length} ${events.length === 1 ? "event" : "events"}.`}
          </p>
        </div>

        {events.length > 0 ? (
          <Button nativeButton={false} render={<Link href={NEW_EVENT_PATH} />}>
            <Plus />
            Create event
          </Button>
        ) : null}
      </div>

      {events.length === 0 ? (
        <Empty className="rounded-xl border border-dashed py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Sparkles />
            </EmptyMedia>
            <EmptyTitle>No events yet</EmptyTitle>
            <EmptyDescription>
              Pick a template and we&rsquo;ll build you a complete event site, filled in with
              example content you can edit section by section.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="lg" nativeButton={false} render={<Link href={NEW_EVENT_PATH} />}>
              <Plus />
              Create your first event
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-4">
          {events.map((event) => (
            <li key={event.id}>
              <EventCard
                now={now}
                event={{
                  id: event.id,
                  slug: event.slug,
                  displayName: event.displayName,
                  publicationStatus: event.publicationStatus,
                  updatedAt: event.updatedAt,
                  latestRequest: event.publishRequests[0] ?? null,
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

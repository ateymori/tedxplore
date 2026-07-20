import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { DeleteEventDialog } from "@/components/events/delete-event-dialog";
import { EventSettingsForm } from "@/components/events/event-settings-form";
import { EventSlugForm } from "@/components/events/event-slug-form";
import { PublicationStatusBadge } from "@/components/events/event-status";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { eventPath } from "@/config/routes";
import { requireUser } from "@/server/auth-guards";
import { isSlugEditable } from "@/server/services/event-rules";
import { loadManageable } from "@/server/services/event-service";

export const metadata: Metadata = { title: "Event settings" };

/**
 * Event settings (task 3.3).
 *
 * Any failure to load becomes a 404, including "you don't own this": the
 * service already collapses those two cases so that probing event ids reveals
 * nothing (see `loadManageable`), and the page must not undo that by rendering
 * a distinguishable error.
 */
export default async function EventSettingsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const user = await requireUser();
  const { eventId } = await params;

  const result = await loadManageable(user, eventId);
  if (!result.ok) notFound();

  const event = result.value;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link
          href={eventPath(event.id)}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to editor
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <PublicationStatusBadge status={event.publicationStatus} />
        </div>
        <p className="truncate text-muted-foreground">{event.displayName}</p>
      </div>

      <Card className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold tracking-tight">Details</h2>
          <p className="text-sm text-muted-foreground">
            Your event&rsquo;s name and the licensing information our review team checks.
          </p>
        </div>
        <Separator />
        <EventSettingsForm
          eventId={event.id}
          defaultValues={{
            displayName: event.displayName,
            tedEventUrl: event.tedEventUrl,
            licenseHolderName: event.licenseHolderName,
          }}
        />
      </Card>

      <Card className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold tracking-tight">Web address</h2>
          <p className="text-sm text-muted-foreground">
            Where your site lives once it&rsquo;s published.
          </p>
        </div>
        <Separator />
        <EventSlugForm
          eventId={event.id}
          slug={event.slug}
          editable={isSlugEditable(event.publicationStatus)}
        />
      </Card>

      <Card className="flex flex-col gap-5 border-destructive/30 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold tracking-tight">Delete this event</h2>
          <p className="text-sm text-muted-foreground">
            Removes the event and its content from your dashboard. If the site has ever been
            published, we keep a record and its address stays reserved.
          </p>
        </div>
        <Separator />
        <div>
          <DeleteEventDialog
            eventId={event.id}
            displayName={event.displayName}
            slug={event.slug}
            publicationStatus={event.publicationStatus}
          />
        </div>
      </Card>
    </div>
  );
}

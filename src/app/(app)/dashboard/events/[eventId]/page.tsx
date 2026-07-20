import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Settings } from "lucide-react";

import { PublicationStatusBadge } from "@/components/events/event-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DASHBOARD_PATH, eventSettingsPath } from "@/config/routes";
import { tedxSitePath } from "@/config/site";
import { requireUser } from "@/server/auth-guards";
import { loadManageable } from "@/server/services/event-service";

export const metadata: Metadata = { title: "Edit event" };

/**
 * Placeholder for the structured editor.
 *
 * Phase 5 replaces this with the real sectioned editor. It exists now so the
 * create flow and the dashboard have a real destination — and because it is
 * where the ownership check lives, the route is already protected correctly
 * when the editor lands on top of it.
 */
export default async function EventEditorPage({
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
          href={DASHBOARD_PATH}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to dashboard
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{event.displayName}</h1>
          <PublicationStatusBadge status={event.publicationStatus} />
        </div>
        <p className="font-mono text-sm text-muted-foreground">{tedxSitePath(event.slug)}</p>
      </div>

      <Card className="flex flex-col items-start gap-4 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold tracking-tight">The editor is coming next</h2>
          <p className="text-sm text-muted-foreground">
            Your event is created and already filled in with example content — speakers, sponsors,
            venue, and FAQs. Section-by-section editing arrives in the next release. Until then you
            can rename your event and manage its address in settings.
          </p>
        </div>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={eventSettingsPath(event.id)} />}
        >
          <Settings />
          Open settings
        </Button>
      </Card>
    </div>
  );
}

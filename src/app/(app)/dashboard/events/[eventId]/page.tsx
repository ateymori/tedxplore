import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Settings } from "lucide-react";

import { EditorShell } from "@/components/editor/editor-shell";
import { PublicationStatusBadge } from "@/components/events/event-status";
import { Button } from "@/components/ui/button";
import { DASHBOARD_PATH, eventSettingsPath } from "@/config/routes";
import { tedxSitePath } from "@/config/site";
import { draftToEditorDefaults } from "@/content/editor-defaults";
import { requireUser } from "@/server/auth-guards";
import { findEventDraft } from "@/server/repositories/event-repository";
import { loadManageable } from "@/server/services/event-service";

export const metadata: Metadata = { title: "Edit event" };

/**
 * The structured editor (Phase 5).
 *
 * Two loads rather than one: `loadManageable` applies the ownership rule and
 * yields the event's identity and concurrency token, then `findEventDraft`
 * fetches the content. Keeping them separate means the authorization check runs
 * against the same function the mutations use — a page that assembled its own
 * query could quietly diverge from what the actions enforce.
 *
 * A non-owner gets `notFound()`, matching the service's refusal to distinguish
 * "doesn't exist" from "isn't yours".
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

  const draft = await findEventDraft(eventId);
  // Only reachable if the event were deleted between the two queries.
  if (draft === null) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link
          href={DASHBOARD_PATH}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to dashboard
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-semibold tracking-tight">
                {event.displayName}
              </h1>
              <PublicationStatusBadge status={event.publicationStatus} />
            </div>
            <p className="font-mono text-sm text-muted-foreground">{tedxSitePath(event.slug)}</p>
          </div>

          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={eventSettingsPath(event.id)} />}
          >
            <Settings />
            Settings
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Your changes save automatically as you type. Everything except the event name is optional
          — leave anything blank and that section simply won&rsquo;t appear on your site.
        </p>
      </div>

      <EditorShell
        eventId={event.id}
        defaults={draftToEditorDefaults(draft)}
        initialUpdatedAt={event.updatedAt}
      />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { DraftSite } from "@/components/preview/draft-site";
import { eventPath } from "@/config/routes";
import { requireUser } from "@/server/auth-guards";
import { findEventDraft } from "@/server/repositories/event-repository";
import { loadManageable } from "@/server/services/event-service";

/**
 * The owner's draft preview (FR-24, task 5.7).
 *
 * The current draft, rendered through the *real* template — the same component,
 * the same serializer, and the same `EventContent` document the published site
 * will use. Not an approximation of the site: the site, built from unpublished
 * content.
 *
 * That equivalence is the whole feature, and it is why this route lives outside
 * the `(app)` group. A page under `/dashboard` inherits the application nav and
 * a constrained `<main>`, and a preview wearing our chrome would answer a
 * different question than the one the organizer is asking.
 *
 * Distinct from Phase 6's `/preview/[token]`, which shows the same thing to
 * someone with a link but no account. This one is gated on ownership.
 */

export const metadata: Metadata = {
  title: "Draft preview",
  // An unpublished draft must never reach an index. Phase 8's public route is
  // the only thing that ever opts a site *in*.
  robots: { index: false, follow: false },
};

export default async function DraftPreviewPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const user = await requireUser();
  const { eventId } = await params;

  // The same ownership rule as the editor, applied by the same function — a
  // preview that was readable by anyone with the id would be an unpublished
  // site leak, and `loadManageable` is what guarantees it isn't.
  const result = await loadManageable(user, eventId);
  if (!result.ok) notFound();

  const event = result.value;

  const draft = await findEventDraft(eventId);
  if (draft === null) notFound();

  return (
    <>
      {/*
        The one piece of chrome, and the only deviation from the published site.
        Without it there is no way back: the template renders no application
        navigation, so an organizer who opened this in the same tab would be
        stranded with the browser's back button as their only exit.

        Fixed rather than in flow so it doesn't shift the layout being previewed,
        and `print:hidden` so a printed preview is the site alone.
      */}
      <div className="fixed top-4 left-4 z-50 print:hidden">
        <Link
          href={eventPath(event.id)}
          className="flex items-center gap-2 rounded-full bg-neutral-900/90 px-4 py-2 text-sm font-medium text-white shadow-lg ring-1 ring-white/20 backdrop-blur transition-colors hover:bg-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <ArrowLeft className="size-4" />
          Back to editor
        </Link>
      </div>

      <DraftSite templateId={event.templateId} draft={draft} />
    </>
  );
}

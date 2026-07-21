import { notFound } from "next/navigation";

import type { EventContent } from "@/content/event-content";
import { findTemplate } from "@/templates/registry";

/**
 * The submitted snapshot, rendered by the real template (task 7.2).
 *
 * ## Why the site renders inline rather than in an iframe
 *
 * An iframe would isolate the template's styles perfectly and would be the
 * obvious choice — but it would need a *route* to point at, and that route
 * would have to serve an unapproved snapshot to whoever could guess its URL.
 * Adding a second, admin-gated public entry point to unpublished content to
 * make a review page tidier is a bad trade. Rendering inline keeps the snapshot
 * inside the authenticated request that already loaded it.
 *
 * Style isolation is not the risk it looks like: Aurora's tokens are
 * `aurora-`-namespaced and its base styles are scoped to the `.aurora` root
 * (Phase 4), specifically so the two design systems cannot touch each other.
 * That decision is what makes this component possible.
 *
 * ## `mode`
 *
 * `"preview"`, not `"public"`. The template uses the mode to suppress things
 * that only make sense on a live site — and a reviewer is looking at something
 * that is, by definition, not live yet. Same mode the owner's preview uses, so
 * all three views of unpublished content agree.
 */
export function ReviewSnapshotFrame({
  templateId,
  content,
  displayName,
  pending,
}: {
  templateId: string;
  content: EventContent;
  displayName: string;
  /** Drives the caption only — a decided request must not still say "if you approve". */
  pending: boolean;
}) {
  const template = findTemplate(templateId);
  // Only reachable if a template were removed from the registry while snapshots
  // still referenced it — a deployment mistake, not user input.
  if (template === null) notFound();

  const { Renderer } = template;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {pending
            ? "Exactly as submitted — this is what goes live if you approve."
            : "Exactly as submitted. Snapshots are never modified, so this is what was reviewed."}
        </span>
        <span className="font-mono">schema v{content.schemaVersion}</span>
      </figcaption>

      {/*
        `contain: paint` is doing real work here, and `overflow-hidden` alone
        does not replace it. The template's site nav is `position: fixed`, which
        anchors to the *viewport* and sails straight out of an overflow-clipped
        box — measured: the organizer's nav landed on top of the admin nav.
        `contain: paint` makes this element a containing block for fixed
        descendants, so the nav pins to the top of the frame instead. `isolate`
        keeps the template's z-indexes from competing with the admin chrome.

        The border makes the boundary of "their site" explicit — without it, a
        reviewer reads the admin nav above as part of the design.
      */}
      <div className="isolate overflow-hidden rounded-xl border bg-background [contain:paint]">
        {/*
          `now` is passed rather than read inside the template (Phase 4). A
          reviewer should see the countdown state a visitor would see *now* —
          including FR-39's post-event state if the event has already passed,
          which is itself worth catching before approving.
        */}
        <Renderer content={content} mode="preview" now={new Date()} />
      </div>

      <figcaption className="sr-only">Rendered preview of {displayName}</figcaption>
    </figure>
  );
}

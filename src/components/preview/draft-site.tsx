import { notFound } from "next/navigation";

import type { EventDraft } from "@/content/serializer";
import { draftToEventContent } from "@/content/serializer";
import { findTemplate } from "@/templates/registry";

/**
 * A draft rendered as the site it will become.
 *
 * Shared by both preview routes — the owner's (`/preview/draft/[eventId]`,
 * FR-24) and the tokenized one (`/preview/[token]`, FR-25) — because the whole
 * promise of a preview is that it is not an approximation. Two call sites each
 * assembling "serializer, then template, in preview mode" is two places for
 * that promise to quietly stop being true; one component means the anonymous
 * viewer and the owner are looking at the same pixels by construction.
 *
 * The routes keep their own authorization. This renders; it decides nothing
 * about who may see it.
 */
export function DraftSite({ templateId, draft }: { templateId: string; draft: EventDraft }) {
  const template = findTemplate(templateId);
  // Only reachable if a template were removed from the registry while events
  // still referenced it — a deployment mistake, not user input.
  if (template === null) notFound();

  const { Renderer } = template;

  // `now` is passed rather than read inside the template (Phase 4): the value a
  // countdown starts from must come from the render, not from module scope.
  return <Renderer content={draftToEventContent(draft)} mode="preview" now={new Date()} />;
}

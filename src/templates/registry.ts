import { AURORA_DEMO_DISPLAY_NAME, auroraDemoSeed } from "@/templates/aurora/demo-content";
import { AuroraPoster } from "@/templates/aurora/poster";
import { AuroraRenderer } from "@/templates/aurora/renderer";
import type { TemplateDefinition } from "@/templates/contract";

/**
 * The template registry.
 *
 * The single place that knows which templates exist. `Event.templateId` is a
 * plain string column, so the database never learns about presentation (C-2)
 * and shipping Template 2 is one entry here plus one directory (NFR-6).
 *
 * V1 ships exactly one template. Everything downstream — the homepage grid
 * (FR-49), the create-event flow — is written against the *list*, not against
 * `aurora`, so the second template needs no changes outside this file.
 */

const aurora: TemplateDefinition = {
  id: "aurora",
  name: "Aurora",
  description:
    "A cinematic single-page site with a full-bleed hero, scroll-driven reveals, and generous typography.",
  demoDisplayName: AURORA_DEMO_DISPLAY_NAME,
  demoSeed: auroraDemoSeed,
  Renderer: AuroraRenderer,
  Poster: AuroraPoster,
  // Placeholders, both captured from this template's own Live Preview: a
  // settled hero screenshot and a slow eased scroll through it. Standing in
  // until Mohammad supplies the final thumbnail/recording at these same paths.
  previewThumbnailSrc: "/templates/aurora/preview-thumbnail.jpg",
  previewAnimationSrc: "/templates/aurora/preview-animated.gif",
};

const TEMPLATES = [aurora] as const;

/** The template a create-event flow uses when the caller names none. */
export const DEFAULT_TEMPLATE_ID = aurora.id;

export function listTemplates(): readonly TemplateDefinition[] {
  return TEMPLATES;
}

/**
 * Returns `null` for an unknown id rather than throwing.
 *
 * `templateId` reaches us from a URL (the homepage's Edit link, FR-51) and
 * from rows written by older code, so "no such template" is an ordinary
 * outcome the caller must handle — a 404 in a route, a validation error in a
 * form — not an exception.
 */
export function findTemplate(id: string): TemplateDefinition | null {
  return TEMPLATES.find((template) => template.id === id) ?? null;
}

export function isTemplateId(id: string): boolean {
  return findTemplate(id) !== null;
}

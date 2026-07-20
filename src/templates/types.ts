import type { ComponentType } from "react";

import type { EventContent, RenderMode, SocialLink, SponsorTier } from "@/content/event-content";
import type { EventDraft } from "@/content/serializer";
import { draftToEventContent } from "@/content/serializer";

/**
 * The template contract.
 *
 * A template is a pure renderer plus the demo content that represents it:
 * `(content: EventContent, mode) → React tree`. Templates never touch the
 * database, and the database holds no template-specific fields (C-2), so
 * adding Template 2 is one directory and one registry entry (NFR-6).
 *
 */

/**
 * Everything a template is allowed to know.
 *
 * There is no event id, no slug, no owner, and no way to reach the database
 * from here — a template is a function of its content and nothing else (C-1).
 * That is what makes one renderer serve the public site, the owner's draft
 * preview, a tokenized preview link, and the homepage demo unchanged.
 */
export interface TemplateRenderProps {
  content: EventContent;
  mode: RenderMode;
  /**
   * Render time, passed rather than read.
   *
   * Templates display time-dependent things — a copyright year, and from
   * Phase 8 anything else that compares against the event date. Published
   * sites are statically rendered, so `new Date()` inside a component would
   * silently freeze at build time with nothing to reveal it. Taking it as a
   * prop keeps the renderer pure and lets tests pin it, exactly as `demoSeed`
   * does.
   *
   * The countdown is the deliberate exception: it needs the *visitor's* clock,
   * not this one, and so ticks client-side.
   */
  now: Date;
}

export type TemplateRenderer = ComponentType<TemplateRenderProps>;

/**
 * A template's placeholder content, in *draft* shape (A-6, FR-10).
 *
 * Authored as a draft rather than as an `EventContent` document because it has
 * two jobs, and only this shape can do both:
 *
 *   1. Seed the relational draft tables of every newly created event, so the
 *      organizer's first look at the editor is a complete site rather than a
 *      set of blank fields.
 *   2. Render the homepage's Live Preview (FR-50) as `EventContent`.
 *
 * Job 2 is derived from job 1 by running the real serializer (`demoContent`
 * below), which is what keeps the demo site and the seeded draft provably
 * identical — the alternative, maintaining an `EventContent` fixture beside
 * the seed, is two sources of truth that silently drift.
 *
 * `displayName` is excluded: it comes from the organizer at creation (FR-8),
 * and the seed must never overwrite the name they just chose.
 *
 * Images are excluded too. Seeded content can't reference `MediaAsset` rows
 * that don't exist, and the hero's absent image is exactly the case FR-38's
 * platform-default visual is designed for — so a fresh event exercises that
 * fallback from day one.
 */
/**
 * The JSON-backed fields are re-typed rather than inherited. `EventDraft`
 * types them `unknown` because they arrive from a `Json` column and are
 * untrusted at that boundary — but demo content is authored here, in
 * TypeScript, where an unchecked `unknown` would happily accept a misspelled
 * platform or tier and only fail when the serializer silently dropped it.
 */
export type TemplateDemoSeed = Omit<
  EventDraft,
  | "displayName"
  | "socialLinks"
  | "heroImage"
  | "venueImage"
  | "speakers"
  | "teamMembers"
  | "sponsors"
  | "faqs"
> & {
  socialLinks: SocialLink[];
  speakers: (Omit<EventDraft["speakers"][number], "id" | "photo" | "links"> & {
    links: SocialLink[];
  })[];
  teamMembers: (Omit<EventDraft["teamMembers"][number], "id" | "photo" | "links"> & {
    links: SocialLink[];
  })[];
  sponsors: (Omit<EventDraft["sponsors"][number], "id" | "logo" | "tier"> & {
    tier: SponsorTier;
  })[];
  faqs: Omit<EventDraft["faqs"][number], "id">[];
};

export interface TemplateDefinition {
  /** Stored verbatim in `Event.templateId`. */
  id: string;
  name: string;
  description: string;
  /** Path to a static preview image, used by the homepage template grid. */
  thumbnail: string;

  /**
   * The event name the Live Preview demo site shows (FR-50).
   *
   * Not part of `demoSeed`: a real event's display name always comes from its
   * organizer, so keeping it out of the seed makes it impossible to
   * accidentally seed it over theirs.
   */
  demoDisplayName: string;

  /**
   * The demo seed, as a factory rather than a constant.
   *
   * Demo content contains an event *date*, and a fixed one would rot: a date
   * in the past renders the "This event has taken place." state (FR-39) on the
   * homepage's Live Preview and in every newly seeded draft. Taking `now`
   * makes the date relative to when it is used and keeps the function pure,
   * which is what lets tests pin it.
   */
  demoSeed: (now: Date) => TemplateDemoSeed;

  /**
   * The renderer itself: `(content, mode, now) → React tree`.
   *
   * Held on the definition rather than resolved by convention from `id`, so
   * that `findTemplate(id).Renderer` is the only lookup any consumer needs and
   * the compiler proves a registered template has one.
   */
  Renderer: TemplateRenderer;
}

/**
 * The demo seed as a renderable document.
 *
 * Runs the same serializer the preview and publish paths use, so anything the
 * serializer drops or normalizes (BR-13) is dropped and normalized here too —
 * the demo site is rendered by exactly the code path a real event uses.
 *
 * The synthetic ids are stable within a call and opaque to templates, which is
 * all `EventContent` promises about them.
 */
export function demoContent(template: TemplateDefinition, now: Date): EventContent {
  const seed = template.demoSeed(now);

  return draftToEventContent({
    ...seed,
    displayName: template.demoDisplayName,
    heroImage: null,
    venueImage: null,
    speakers: seed.speakers.map((speaker, index) => ({
      ...speaker,
      id: `demo-speaker-${index}`,
      photo: null,
    })),
    teamMembers: seed.teamMembers.map((member, index) => ({
      ...member,
      id: `demo-team-${index}`,
      photo: null,
    })),
    sponsors: seed.sponsors.map((sponsor, index) => ({
      ...sponsor,
      id: `demo-sponsor-${index}`,
      logo: null,
    })),
    faqs: seed.faqs.map((faq, index) => ({ ...faq, id: `demo-faq-${index}` })),
  });
}

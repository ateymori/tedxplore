import { z } from "zod";

import {
  MAX_FAQS,
  MAX_SPEAKERS,
  MAX_SPONSORS,
  MAX_TEAM_MEMBERS,
  THEME_MAX_LENGTH,
} from "@/config/limits";
import { displayNameSchema } from "@/lib/validation/display-name";
import { externalUrlSchema } from "@/lib/validation/url";

/**
 * `EventContent` — the contract between content and presentation.
 *
 * Everything a template needs to render a site, and nothing else. Drafts
 * (relational tables) serialize *into* this shape; snapshots freeze it as
 * JSON; templates consume *only* it and never touch the database.
 *
 * Two rules govern every field below:
 *
 * 1. **`displayName` is the only required field** (FR-15a). Encoding that
 *    here means no downstream layer can quietly re-require something: an
 *    almost-empty draft is a valid `EventContent` document. The much stricter
 *    submission gate (BR-14) is a separate check in `./completeness.ts`.
 *
 * 2. **Absent values are `null`, never `undefined`.** Snapshots round-trip
 *    through `JSON.stringify`, which drops `undefined` keys entirely — so an
 *    optional field would silently change shape between the draft-preview
 *    path and the published path. `null` survives, keeping the two identical.
 *
 * Changing this file is never a solo edit: the Zod schema, the serializer,
 * the template, and (from Phase 8) the snapshot upgrader move together.
 */

/**
 * Bump only for a breaking shape change, and never alone: `content/upgrade.ts`
 * needs a migration keyed to the version being left behind, or every snapshot
 * already in the database stops rendering. Its doc comment lists the full
 * checklist.
 */
export const CURRENT_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

/**
 * A Cloudinary-backed image.
 *
 * Intrinsic dimensions travel with the reference so templates can reserve
 * layout space and avoid cumulative layout shift without a round trip.
 *
 * Deliberately no `alt` field: every image slot in V1 has an adjacent piece
 * of content that describes it better than a separate input would (speaker
 * name, sponsor name, venue name), and the hero background is decorative and
 * takes `alt=""`. Templates derive alt text contextually (NFR-3). Add a
 * user-supplied `alt` here only if a future slot has no such context.
 */
export const imageRefSchema = z.object({
  cloudinaryPublicId: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

/**
 * Known platforms get a real icon in the template; `OTHER` renders a generic
 * link glyph, so an unrecognized platform degrades rather than breaking.
 */
export const socialPlatformSchema = z.enum([
  "WEBSITE",
  "INSTAGRAM",
  "X",
  "FACEBOOK",
  "LINKEDIN",
  "YOUTUBE",
  "TIKTOK",
  "OTHER",
]);

export const socialLinkSchema = z.object({
  platform: socialPlatformSchema,
  url: externalUrlSchema,
});

// ---------------------------------------------------------------------------
// List items
// ---------------------------------------------------------------------------

/**
 * `id` is carried into content so templates have stable React keys and can
 * build deep-link anchors. It is the draft row's id at serialization time —
 * meaningful for correlation, but templates must treat it as opaque.
 */
export const speakerContentSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  title: z.string().nullable(),
  bio: z.string().nullable(),
  talkTitle: z.string().nullable(),
  photo: imageRefSchema.nullable(),
  links: z.array(socialLinkSchema),
});

export const teamMemberContentSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  role: z.string().nullable(),
  photo: imageRefSchema.nullable(),
  links: z.array(socialLinkSchema),
});

export const sponsorTierSchema = z.enum([
  "PARTNER",
  "PLATINUM",
  "GOLD",
  "SILVER",
  "BRONZE",
  "COMMUNITY",
]);

/**
 * Sponsors stay a flat, ordered list rather than pre-grouped by tier:
 * grouping and per-tier auto-hiding (FR-38) are presentation decisions, and
 * a future template may choose to group differently.
 */
export const sponsorContentSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  tier: sponsorTierSchema,
  logo: imageRefSchema.nullable(),
  websiteUrl: externalUrlSchema.nullable(),
});

export const faqContentSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  answer: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export const eventScheduleContentSchema = z.object({
  /**
   * The event instant, as an ISO 8601 UTC string. Absolute, so the countdown
   * is unambiguous; `timezone` is carried alongside purely so the template can
   * *display* the local date and time the organizer means.
   */
  startsAt: z.iso.datetime().nullable(),
  /** IANA timezone name, e.g. "America/Toronto". */
  timezone: z.string().nullable(),
});

export const venueContentSchema = z.object({
  name: z.string().nullable(),
  address: z.string().nullable(),
  description: z.string().nullable(),
  image: imageRefSchema.nullable(),
});

export const contactContentSchema = z.object({
  email: z.email().nullable(),
  socialLinks: z.array(socialLinkSchema),
});

// ---------------------------------------------------------------------------
// The document
// ---------------------------------------------------------------------------

export const eventContentSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),

  /** BR-5c: the one field that is always present and never blank. */
  displayName: displayNameSchema,

  /**
   * BR-5d. Null is a normal, expected state — the Hero is always rendered, so
   * the *template* substitutes platform-default subtitle copy (FR-38). That
   * default deliberately lives in the renderer, not here: keeping it out of
   * the frozen snapshot means improving the copy later also improves every
   * site published before the change.
   */
  theme: z.string().max(THEME_MAX_LENGTH).nullable(),

  about: z.string().nullable(),

  /** Decorative hero/background image; falls back to a template visual (FR-38). */
  heroImage: imageRefSchema.nullable(),

  schedule: eventScheduleContentSchema,
  venue: venueContentSchema,
  contact: contactContentSchema,

  registrationUrl: externalUrlSchema.nullable(),

  // Lists are always arrays — empty, never null. "No speakers yet" and "the
  // speakers section is absent" are the same state (BR-13), and one
  // representation for it means templates never branch on null vs [].
  speakers: z.array(speakerContentSchema).max(MAX_SPEAKERS),
  team: z.array(teamMemberContentSchema).max(MAX_TEAM_MEMBERS),
  sponsors: z.array(sponsorContentSchema).max(MAX_SPONSORS),
  faqs: z.array(faqContentSchema).max(MAX_FAQS),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EventContent = z.infer<typeof eventContentSchema>;
export type ImageRef = z.infer<typeof imageRefSchema>;
export type SocialLink = z.infer<typeof socialLinkSchema>;
export type SocialPlatform = z.infer<typeof socialPlatformSchema>;
export type SpeakerContent = z.infer<typeof speakerContentSchema>;
export type TeamMemberContent = z.infer<typeof teamMemberContentSchema>;
export type SponsorContent = z.infer<typeof sponsorContentSchema>;
export type SponsorTier = z.infer<typeof sponsorTierSchema>;
export type FaqContent = z.infer<typeof faqContentSchema>;
export type VenueContent = z.infer<typeof venueContentSchema>;
export type ContactContent = z.infer<typeof contactContentSchema>;

/** How a template is being rendered; templates may adapt chrome accordingly. */
export type RenderMode = "public" | "preview" | "demo";

/**
 * The minimum valid document: a display name and nothing else. Used as the
 * base for tests and demo fixtures so a "minimal draft" case can't drift out
 * of sync with the schema.
 */
export function emptyEventContent(displayName: string): EventContent {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    displayName,
    theme: null,
    about: null,
    heroImage: null,
    schedule: { startsAt: null, timezone: null },
    venue: { name: null, address: null, description: null, image: null },
    contact: { email: null, socialLinks: [] },
    registrationUrl: null,
    speakers: [],
    team: [],
    sponsors: [],
    faqs: [],
  };
}

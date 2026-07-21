import { z } from "zod";

import {
  MAX_FAQS,
  MAX_SPEAKERS,
  MAX_SPONSORS,
  MAX_TEAM_MEMBERS,
  THEME_MAX_LENGTH,
} from "@/config/limits";
import { zonedWallTimeToUtc, isValidTimeZone } from "@/lib/datetime";
import { displayNameSchema } from "@/lib/validation/display-name";
import { externalUrlSchema } from "@/lib/validation/url";

/**
 * Draft content validation (FR-19), one schema per editor section.
 *
 * Shared by the client forms and the Server Actions they submit to, so the
 * message a user reads inline is the one the server would have produced —
 * client validation is UX, never the boundary (NFR-5).
 *
 * The governing rule is FR-15a: **`displayName` is the only field that is ever
 * required.** Everything else validates *format* when a value is present and
 * accepts blank otherwise. That is not laxness — organizers routinely start a
 * site before the programme exists, and a schema that demanded a venue would
 * make the product unusable for its actual first-week workflow. The strict gate
 * lives at submission (BR-14, `content/completeness.ts`), where it belongs.
 *
 * These schemas describe the *editor's* wire format, which is deliberately not
 * `EventContent`: text inputs produce `""` for empty, the date arrives as wall
 * time plus a zone, and list rows carry their database ids. Normalizing that
 * into the content contract is the serializer's job, downstream.
 */

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

/**
 * An optional free-text field: blank in, `null` out.
 *
 * Every text input in the editor submits `""` when the user clears it, and
 * every corresponding column is nullable. Collapsing the two here means no
 * form has to remember to send `null` and no action has to remember to convert
 * — and it matches what the serializer already does for whitespace-only values
 * (BR-13), so an "empty" field means the same thing at every layer.
 *
 * The length bound is applied *after* trimming, so trailing whitespace can
 * never be what pushes a value over the limit.
 */
function optionalText(maxLength: number, label: string) {
  return z
    .string()
    .nullish()
    .transform((value) => {
      const trimmed = (value ?? "").trim();
      return trimmed.length === 0 ? null : trimmed;
    })
    .pipe(
      z
        .string()
        .max(maxLength, { error: `${label} must be at most ${maxLength} characters.` })
        .nullable(),
    );
}

/** An optional URL: blank is fine, anything else must satisfy BR-12. */
function optionalUrl() {
  return z
    .string()
    .nullish()
    .transform((value) => {
      const trimmed = (value ?? "").trim();
      return trimmed.length === 0 ? null : trimmed;
    })
    .pipe(externalUrlSchema.nullable());
}

const optionalEmail = () =>
  z
    .string()
    .nullish()
    .transform((value) => {
      const trimmed = (value ?? "").trim();
      return trimmed.length === 0 ? null : trimmed;
    })
    .pipe(z.email({ error: "Enter a valid email address." }).nullable());

/**
 * Free-text length caps.
 *
 * Not in `config/limits.ts`: that file is the home of the business rules
 * (BR-11 counts, the 10 MB image cap, BR-5d's theme length) and of values other
 * layers must agree on. These are ordinary field bounds with no rule behind
 * them — they exist so a paste of an entire document can't land in a column —
 * and scattering them into the shared config would bury the rules that matter
 * among two dozen numbers nothing else reads.
 */
export const CONTENT_TEXT_LIMITS = {
  about: 4000,
  personName: 120,
  personTitle: 160,
  personBio: 1200,
  talkTitle: 200,
  venueName: 160,
  venueAddress: 300,
  venueDescription: 2000,
  sponsorName: 120,
  faqQuestion: 300,
  faqAnswer: 2000,
} as const;

// ---------------------------------------------------------------------------
// Social links
// ---------------------------------------------------------------------------

export const socialPlatformInputSchema = z.enum([
  "WEBSITE",
  "INSTAGRAM",
  "X",
  "FACEBOOK",
  "LINKEDIN",
  "YOUTUBE",
  "TIKTOK",
  "OTHER",
]);

/**
 * A link row as the editor submits it.
 *
 * Rows with a blank URL are dropped by `socialLinksSchema` rather than
 * rejected: an empty row is what a freshly clicked "Add link" button produces,
 * and refusing to save the section around it would make the button a trap.
 * A row with a *malformed* URL is a different matter and does fail — the user
 * typed something and deserves to be told it won't work.
 */
const socialLinkInputSchema = z.object({
  platform: socialPlatformInputSchema,
  url: z.string(),
});

/** How many links one person or one event may list. A UI sanity bound. */
export const MAX_SOCIAL_LINKS = 6;

export const socialLinksSchema = z
  .array(socialLinkInputSchema)
  .nullish()
  .transform((links) => (links ?? []).filter((link) => link.url.trim().length > 0))
  .pipe(
    z
      .array(z.object({ platform: socialPlatformInputSchema, url: externalUrlSchema }))
      .max(MAX_SOCIAL_LINKS, { error: `You can add at most ${MAX_SOCIAL_LINKS} links.` }),
  );

// ---------------------------------------------------------------------------
// Basics (task 5.3)
// ---------------------------------------------------------------------------

/**
 * The hero section's editable content.
 *
 * `displayName` is required on every save (FR-15a) and reuses the create
 * form's schema, so BR-5a/b's charset rules can't drift between the two places
 * a name is set. `theme` is the FR-38 case — blank is normal and the template
 * substitutes platform copy, which is why the form says so rather than
 * flagging it.
 */
export const heroContentSchema = z.object({
  displayName: displayNameSchema,
  theme: optionalText(THEME_MAX_LENGTH, "Theme"),
});

export type HeroContentInput = z.input<typeof heroContentSchema>;
export type HeroContentValues = z.output<typeof heroContentSchema>;

export const aboutContentSchema = z.object({
  aboutText: optionalText(CONTENT_TEXT_LIMITS.about, "About"),
});

export type AboutContentInput = z.input<typeof aboutContentSchema>;

/**
 * Date and time (FR-15).
 *
 * The organizer answers in wall time — "6pm, in Toronto" — and the server
 * resolves it to the absolute instant `EventContent` stores. Doing the
 * conversion here rather than in the component means a hand-crafted request
 * gets the same treatment as the form, and the stored instant is never
 * whatever the *submitting browser's* clock happened to imply.
 *
 * A date with no timezone is refused. The alternative — defaulting to UTC —
 * would quietly publish a time that is wrong by hours, and a countdown that is
 * silently wrong is worse than a field that asks one more question.
 */
export const scheduleContentSchema = z
  .object({
    /** `YYYY-MM-DDTHH:mm`, as `<input type="datetime-local">` produces. */
    eventDate: z
      .string()
      .nullish()
      .transform((value) => {
        const trimmed = (value ?? "").trim();
        return trimmed.length === 0 ? null : trimmed;
      }),
    timezone: z
      .string()
      .nullish()
      .transform((value) => {
        const trimmed = (value ?? "").trim();
        return trimmed.length === 0 ? null : trimmed;
      }),
  })
  .check((ctx) => {
    const { eventDate, timezone } = ctx.value;

    if (timezone !== null && !isValidTimeZone(timezone)) {
      ctx.issues.push({
        code: "custom",
        input: timezone,
        path: ["timezone"],
        message: "Choose a timezone from the list.",
      });
      return;
    }

    if (eventDate === null) return;

    if (timezone === null) {
      ctx.issues.push({
        code: "custom",
        input: timezone,
        path: ["timezone"],
        message: "Choose a timezone so the countdown shows the right time.",
      });
      return;
    }

    if (zonedWallTimeToUtc(eventDate, timezone) === null) {
      ctx.issues.push({
        code: "custom",
        input: eventDate,
        path: ["eventDate"],
        message: "Enter a valid date and time.",
      });
    }
  })
  .transform(({ eventDate, timezone }) => ({
    // Safe by the check above: a non-null `eventDate` implies a valid zone and
    // a resolvable instant.
    eventDate:
      eventDate === null || timezone === null ? null : zonedWallTimeToUtc(eventDate, timezone),
    // A timezone with no date is kept, not discarded — picking the zone first
    // and the date later is a normal order to fill the form in.
    timezone,
  }));

export type ScheduleContentInput = z.input<typeof scheduleContentSchema>;
/**
 * The schedule is the one section whose validated output differs in *type*
 * from its input — the wall-time string becomes a `Date`. React Hook Form has
 * to be told, via `useForm`'s third generic, or the resolver won't typecheck
 * against the form.
 */
export type ScheduleContentValues = z.output<typeof scheduleContentSchema>;

export const contactContentSchema = z.object({
  contactEmail: optionalEmail(),
  socialLinks: socialLinksSchema,
});

export type ContactContentInput = z.input<typeof contactContentSchema>;

export const registrationContentSchema = z.object({
  registrationUrl: optionalUrl(),
});

export type RegistrationContentInput = z.input<typeof registrationContentSchema>;

// ---------------------------------------------------------------------------
// Venue (task 5.6)
// ---------------------------------------------------------------------------

export const venueContentSchema = z.object({
  venueName: optionalText(CONTENT_TEXT_LIMITS.venueName, "Venue name"),
  venueAddress: optionalText(CONTENT_TEXT_LIMITS.venueAddress, "Address"),
  venueDescription: optionalText(CONTENT_TEXT_LIMITS.venueDescription, "Description"),
});

export type VenueContentInput = z.input<typeof venueContentSchema>;

// ---------------------------------------------------------------------------
// List sections (task 5.5)
// ---------------------------------------------------------------------------

/**
 * A person's name is required *within a row that exists* — which is not the
 * same as requiring the row. An organizer may keep zero speakers indefinitely
 * (FR-15a); what they may not do is save a row with nothing in it, because the
 * serializer would drop it (BR-13) and the editor would then show a row the
 * public site refuses to render, with no explanation.
 */
const personNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Name is required." })
  .max(CONTENT_TEXT_LIMITS.personName, {
    error: `Must be at most ${CONTENT_TEXT_LIMITS.personName} characters.`,
  });

export const speakerContentSchema = z.object({
  name: personNameSchema,
  title: optionalText(CONTENT_TEXT_LIMITS.personTitle, "Title"),
  talkTitle: optionalText(CONTENT_TEXT_LIMITS.talkTitle, "Talk title"),
  bio: optionalText(CONTENT_TEXT_LIMITS.personBio, "Bio"),
  links: socialLinksSchema,
});

export type SpeakerContentInput = z.input<typeof speakerContentSchema>;

export const teamMemberContentSchema = z.object({
  name: personNameSchema,
  role: optionalText(CONTENT_TEXT_LIMITS.personTitle, "Role"),
  links: socialLinksSchema,
});

export type TeamMemberContentInput = z.input<typeof teamMemberContentSchema>;

export const sponsorTierInputSchema = z.enum([
  "PARTNER",
  "PLATINUM",
  "GOLD",
  "SILVER",
  "BRONZE",
  "COMMUNITY",
]);

export const sponsorContentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Sponsor name is required." })
    .max(CONTENT_TEXT_LIMITS.sponsorName, {
      error: `Must be at most ${CONTENT_TEXT_LIMITS.sponsorName} characters.`,
    }),
  tier: sponsorTierInputSchema,
  websiteUrl: optionalUrl(),
});

export type SponsorContentInput = z.input<typeof sponsorContentSchema>;

/**
 * Both halves of a FAQ are required, matching the serializer's usability rule:
 * a question with no answer is worse than no FAQ at all, so it would be
 * dropped from the published site — and a field the editor accepts but the
 * site silently discards is the exact failure mode this schema exists to
 * prevent.
 */
export const faqContentSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, { error: "Question is required." })
    .max(CONTENT_TEXT_LIMITS.faqQuestion, {
      error: `Must be at most ${CONTENT_TEXT_LIMITS.faqQuestion} characters.`,
    }),
  answer: z
    .string()
    .trim()
    .min(1, { error: "Answer is required." })
    .max(CONTENT_TEXT_LIMITS.faqAnswer, {
      error: `Must be at most ${CONTENT_TEXT_LIMITS.faqAnswer} characters.`,
    }),
});

export type FaqContentInput = z.input<typeof faqContentSchema>;

/**
 * Reordering (FR-18): the full list of row ids in their new order.
 *
 * Sending the whole order rather than a `{ id, from, to }` move keeps the
 * server stateless about what the client's list looked like, and makes the
 * write idempotent — a retried drag can't apply twice.
 */
export const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).max(
    // The largest list the editor can produce; a bound so a hostile client
    // can't make the server sort an unbounded array.
    Math.max(MAX_SPEAKERS, MAX_TEAM_MEMBERS, MAX_SPONSORS, MAX_FAQS),
  ),
});

export type ReorderInput = z.infer<typeof reorderSchema>;

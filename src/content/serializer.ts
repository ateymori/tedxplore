import {
  CURRENT_SCHEMA_VERSION,
  eventContentSchema,
  socialLinkSchema,
  type EventContent,
  type ImageRef,
  type SocialLink,
} from "./event-content";

/**
 * Draft → `EventContent`.
 *
 * The one place relational draft rows become the frozen document templates
 * render. Everything downstream — preview, review, the public site — reads
 * the output of this function (directly, or via a snapshot of it).
 *
 * The serializer's job is *normalization*, not judgement: blank strings
 * become `null`, whitespace is trimmed, and unusable rows are dropped. It
 * never rejects a draft for being incomplete — that is the submission gate's
 * job (`./completeness.ts`), and conflating the two would make an early-stage
 * draft unpreviewable.
 */

// The input shape is declared structurally rather than imported from
// `@prisma/client`: this module is pure domain logic and must stay usable
// from tests, demo fixtures, and any future non-Prisma source (NFR-9).

export interface DraftImage {
  cloudinaryPublicId: string;
  width: number;
  height: number;
}

export interface DraftSpeaker {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  talkTitle: string | null;
  photo: DraftImage | null;
  links: unknown;
  sortOrder: number;
}

export interface DraftTeamMember {
  id: string;
  name: string;
  role: string | null;
  photo: DraftImage | null;
  links: unknown;
  sortOrder: number;
}

export interface DraftSponsor {
  id: string;
  name: string;
  tier: string;
  logo: DraftImage | null;
  websiteUrl: string | null;
  sortOrder: number;
}

export interface DraftFaq {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
}

export interface EventDraft {
  displayName: string;
  theme: string | null;
  aboutText: string | null;
  eventDate: Date | null;
  timezone: string | null;
  venueName: string | null;
  venueAddress: string | null;
  venueDescription: string | null;
  contactEmail: string | null;
  registrationUrl: string | null;
  socialLinks: unknown;
  heroImage: DraftImage | null;
  venueImage: DraftImage | null;
  speakers: DraftSpeaker[];
  teamMembers: DraftTeamMember[];
  sponsors: DraftSponsor[];
  faqs: DraftFaq[];
}

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

/**
 * BR-13's "no non-blank content" rule at the field level: a field holding only
 * whitespace is indistinguishable from an empty one, and collapsing both to
 * `null` here means no downstream consumer has to remember to trim.
 */
function text(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function image(value: DraftImage | null | undefined): ImageRef | null {
  if (!value) return null;
  return {
    cloudinaryPublicId: value.cloudinaryPublicId,
    width: value.width,
    height: value.height,
  };
}

/**
 * `socialLinks` and per-person `links` are `Json` columns, so their contents
 * are untrusted at this boundary even though they were validated on write.
 * Individually invalid entries are dropped rather than failing the whole
 * serialization — one malformed link should never make an event unrenderable.
 */
function socialLinks(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = socialLinkSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

/**
 * A URL that failed validation is dropped, not passed through: BR-12 is a
 * security boundary, and the draft may predate a tightening of the rule.
 */
function externalUrl(value: string | null | undefined): string | null {
  const trimmed = text(value);
  if (trimmed === null) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

function bySortOrder<T extends { sortOrder: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

// ---------------------------------------------------------------------------
// Usable-content rules (BR-13)
// ---------------------------------------------------------------------------

/**
 * A list row is "usable" when it carries the one piece of content that makes
 * it renderable at all. A speaker with no name is a placeholder the organizer
 * created and never filled in — showing an anonymous card would look broken,
 * so it is omitted from the published document entirely.
 *
 * Note this is about *rendering*, not validation: the row stays in the draft
 * so the organizer can still see and finish it in the editor.
 */
function hasName(item: { name: string }): boolean {
  return text(item.name) !== null;
}

function isUsableFaq(faq: DraftFaq): boolean {
  // Both halves are required — a question with no answer is worse than no FAQ.
  return text(faq.question) !== null && text(faq.answer) !== null;
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Produces a validated `EventContent`. Throws if the result does not satisfy
 * the schema, which — given the normalization above — can only happen when
 * `displayName` is blank, an invariant the editor enforces on every save
 * (FR-15a). A throw here means a real bug, not bad user input.
 */
export function draftToEventContent(draft: EventDraft): EventContent {
  const content = {
    schemaVersion: CURRENT_SCHEMA_VERSION,

    displayName: draft.displayName.trim().normalize("NFC"),
    theme: text(draft.theme),
    about: text(draft.aboutText),
    heroImage: image(draft.heroImage),

    schedule: {
      // Serialized as an absolute UTC instant; `timezone` says how to display
      // it. See `eventScheduleContentSchema`.
      startsAt: draft.eventDate ? draft.eventDate.toISOString() : null,
      timezone: text(draft.timezone),
    },

    venue: {
      name: text(draft.venueName),
      address: text(draft.venueAddress),
      description: text(draft.venueDescription),
      image: image(draft.venueImage),
    },

    contact: {
      email: text(draft.contactEmail),
      socialLinks: socialLinks(draft.socialLinks),
    },

    registrationUrl: externalUrl(draft.registrationUrl),

    speakers: bySortOrder(draft.speakers)
      .filter(hasName)
      .map((speaker) => ({
        id: speaker.id,
        name: speaker.name.trim(),
        title: text(speaker.title),
        bio: text(speaker.bio),
        talkTitle: text(speaker.talkTitle),
        photo: image(speaker.photo),
        links: socialLinks(speaker.links),
      })),

    team: bySortOrder(draft.teamMembers)
      .filter(hasName)
      .map((member) => ({
        id: member.id,
        name: member.name.trim(),
        role: text(member.role),
        photo: image(member.photo),
        links: socialLinks(member.links),
      })),

    sponsors: bySortOrder(draft.sponsors)
      .filter(hasName)
      .map((sponsor) => ({
        id: sponsor.id,
        name: sponsor.name.trim(),
        tier: sponsor.tier,
        logo: image(sponsor.logo),
        websiteUrl: externalUrl(sponsor.websiteUrl),
      })),

    faqs: bySortOrder(draft.faqs)
      .filter(isUsableFaq)
      .map((faq) => ({
        id: faq.id,
        question: faq.question.trim(),
        answer: faq.answer.trim(),
      })),
  };

  return eventContentSchema.parse(content);
}

// ---------------------------------------------------------------------------
// Section visibility (BR-13)
// ---------------------------------------------------------------------------

/**
 * Which optional sections have usable content.
 *
 * Templates own the *rendering* decision, but the rule for what counts as
 * empty is domain logic and belongs here — so the editor, the completeness
 * check, and every future template agree on it.
 *
 * The always-rendered sections (Hero, About TED, About TEDx, disclaimer,
 * footer) are absent from this list by design: they have no visibility
 * decision to make (FR-38).
 */
export interface SectionVisibility {
  about: boolean;
  venue: boolean;
  speakers: boolean;
  team: boolean;
  sponsors: boolean;
  faqs: boolean;
  contact: boolean;
  countdown: boolean;
  registration: boolean;
}

export function sectionVisibility(content: EventContent): SectionVisibility {
  return {
    about: content.about !== null,
    // Any one venue detail is enough to be worth showing — an address with no
    // name still helps an attendee get there.
    venue:
      content.venue.name !== null ||
      content.venue.address !== null ||
      content.venue.description !== null ||
      content.venue.image !== null,
    speakers: content.speakers.length > 0,
    team: content.team.length > 0,
    sponsors: content.sponsors.length > 0,
    faqs: content.faqs.length > 0,
    contact: content.contact.email !== null || content.contact.socialLinks.length > 0,
    countdown: content.schedule.startsAt !== null,
    registration: content.registrationUrl !== null,
  };
}

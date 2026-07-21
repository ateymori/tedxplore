import type { EventDraft } from "@/content/serializer";
import { socialLinkSchema, type ImageRef, type SocialLink } from "@/content/event-content";
import { utcToZonedWallTime } from "@/lib/datetime";
import type {
  AboutContentInput,
  ContactContentInput,
  FaqContentInput,
  HeroContentInput,
  RegistrationContentInput,
  ScheduleContentInput,
  SpeakerContentInput,
  SponsorContentInput,
  TeamMemberContentInput,
  VenueContentInput,
} from "@/lib/validation/content";

/**
 * Draft rows → the editor's initial form values (Phase 5).
 *
 * The counterpart to `draftToEventContent`: that one prepares a draft for
 * *rendering*, this one prepares it for *editing*. They differ in two ways
 * that matter, which is exactly why the editor cannot reuse the serializer:
 *
 *   1. **Nothing is dropped.** The serializer omits rows with no usable
 *      content (BR-13) — a speaker with a blank name never reaches the public
 *      site. But that row still exists, and the organizer needs to see it in
 *      the editor to finish or delete it. Serializer output would make it
 *      invisible and unfixable.
 *
 *   2. **`null` becomes `""`.** Controlled inputs need a string; React logs a
 *      warning and switches the input to uncontrolled if it is handed `null`,
 *      after which typing in it stops updating form state. The reverse
 *      conversion happens in `optionalText` on the way back.
 *
 * Pure, and typed against the same `*Input` types the forms declare, so a field
 * renamed in a schema fails to compile here rather than silently arriving as
 * `undefined` and blanking itself on the next autosave.
 */

/** Blank-to-empty-string, the inverse of the schemas' `optionalText`. */
function value(text: string | null | undefined): string {
  return text ?? "";
}

/**
 * `links` and `socialLinks` are `Json` columns, so their contents are untrusted
 * here for the same reason they are in the serializer. Invalid entries are
 * dropped rather than failing the whole page — one malformed link should never
 * make an event uneditable, which would be a trap with no way out.
 */
function socialLinks(raw: unknown): SocialLink[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry) => {
    const parsed = socialLinkSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Drops the draft row's extra columns down to what a template would render. */
function imageRef(image: { cloudinaryPublicId: string; width: number; height: number } | null) {
  if (image === null) return null;
  return {
    cloudinaryPublicId: image.cloudinaryPublicId,
    width: image.width,
    height: image.height,
  };
}

/*
 * Row types are the form's input shape plus the two things the form does not
 * own: the database id, and the image. Images are attached by their own
 * request rather than by the row's autosave (see `ImageField`), so keeping
 * them beside the form values rather than inside them is what stops a text
 * save from ever carrying a stale photo reference.
 */

export interface SpeakerRow extends SpeakerContentInput {
  id: string;
  photo: ImageRef | null;
}

export interface TeamMemberRow extends TeamMemberContentInput {
  id: string;
  photo: ImageRef | null;
}

export interface SponsorRow extends SponsorContentInput {
  id: string;
  logo: ImageRef | null;
}

export interface FaqRow extends FaqContentInput {
  id: string;
}

export interface EditorDefaults {
  hero: HeroContentInput;
  /**
   * The two image slots that live on the event row itself. Kept beside the
   * text sections rather than inside them because images are not part of the
   * autosave forms — see `ImageField`.
   */
  heroImage: ImageRef | null;
  venueImage: ImageRef | null;
  about: AboutContentInput;
  schedule: ScheduleContentInput;
  contact: ContactContentInput;
  registration: RegistrationContentInput;
  venue: VenueContentInput;
  speakers: SpeakerRow[];
  team: TeamMemberRow[];
  sponsors: SponsorRow[];
  faqs: FaqRow[];
}

function bySortOrder<T extends { sortOrder: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function draftToEditorDefaults(draft: EventDraft): EditorDefaults {
  return {
    hero: {
      displayName: draft.displayName,
      theme: value(draft.theme),
    },

    heroImage: imageRef(draft.heroImage),
    venueImage: imageRef(draft.venueImage),

    about: { aboutText: value(draft.aboutText) },

    schedule: {
      /*
       * Rendered back into the organizer's *own* timezone, not the viewer's.
       * `utcToZonedWallTime` is an exact inverse of the conversion the schema
       * applies on save, so opening the editor and saving without touching the
       * field leaves the instant untouched — the alternative would silently
       * shift a published event's start time every time someone in another
       * country opened the page.
       *
       * With no timezone stored there is nothing to render the instant *in*,
       * so the date field starts blank and the schema then insists on a zone
       * before it will accept a date.
       */
      eventDate:
        draft.eventDate === null || draft.timezone === null
          ? ""
          : (utcToZonedWallTime(draft.eventDate, draft.timezone) ?? ""),
      timezone: value(draft.timezone),
    },

    contact: {
      contactEmail: value(draft.contactEmail),
      socialLinks: socialLinks(draft.socialLinks),
    },

    registration: { registrationUrl: value(draft.registrationUrl) },

    venue: {
      venueName: value(draft.venueName),
      venueAddress: value(draft.venueAddress),
      venueDescription: value(draft.venueDescription),
    },

    speakers: bySortOrder(draft.speakers).map((speaker) => ({
      id: speaker.id,
      name: speaker.name,
      title: value(speaker.title),
      talkTitle: value(speaker.talkTitle),
      bio: value(speaker.bio),
      links: socialLinks(speaker.links),
      photo: imageRef(speaker.photo),
    })),

    team: bySortOrder(draft.teamMembers).map((member) => ({
      id: member.id,
      name: member.name,
      role: value(member.role),
      links: socialLinks(member.links),
      photo: imageRef(member.photo),
    })),

    sponsors: bySortOrder(draft.sponsors).map((sponsor) => ({
      id: sponsor.id,
      name: sponsor.name,
      // The column is a Prisma enum, so this is a widening cast in the type
      // system only; the value is already constrained by the database.
      tier: sponsor.tier as SponsorRow["tier"],
      websiteUrl: value(sponsor.websiteUrl),
      logo: imageRef(sponsor.logo),
    })),

    faqs: bySortOrder(draft.faqs).map((faq) => ({
      id: faq.id,
      question: faq.question,
      answer: faq.answer,
    })),
  };
}

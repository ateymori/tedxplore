import type { EventDraft } from "@/content/serializer";

import { prisma } from "./prisma";

/**
 * Event data access.
 *
 * This layer — and only this layer — imports the Prisma client (NFR-9).
 * Services above it work with plain domain types, so swapping the database
 * provider or the ORM never reaches domain logic or the UI.
 *
 * Repositories hold no business rules: no authorization, no state-machine
 * checks, no limit enforcement. Those live in services, where they can be
 * tested without a database.
 */

/**
 * Everything the serializer needs, in one query.
 *
 * The `include` here is the shape `draftToEventContent` expects; keeping the
 * two adjacent means a field added to `EventDraft` fails to compile until it
 * is actually fetched.
 */
const draftInclude = {
  heroImage: true,
  venueImage: true,
  speakers: { include: { photo: true } },
  teamMembers: { include: { photo: true } },
  sponsors: { include: { logo: true } },
  faqs: true,
} as const;

export async function findEventById(id: string) {
  return prisma.event.findFirst({ where: { id, deletedAt: null } });
}

/** BR-2: the public-site lookup. Soft-deleted events are invisible (FR-42). */
export async function findEventBySlug(slug: string) {
  return prisma.event.findFirst({ where: { slug, deletedAt: null } });
}

/**
 * BR-3 uniqueness check.
 *
 * Includes soft-deleted events on purpose: their slugs stay reserved (only a
 * hard delete releases one — flow 4.3), so a soft-deleted site's URL can never
 * be claimed by someone else and silently inherit its inbound links.
 */
export async function isSlugTaken(slug: string): Promise<boolean> {
  const existing = await prisma.event.findUnique({
    where: { slug },
    select: { id: true },
  });
  return existing !== null;
}

/** Dashboard listing (FR-11). */
export async function listEventsByOwner(ownerId: string) {
  return prisma.event.findMany({
    where: { ownerId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Loads the draft in the exact shape `draftToEventContent` consumes.
 *
 * Returns `null` when the event doesn't exist so callers distinguish that
 * from "exists but empty" — which is a perfectly normal draft (FR-15a).
 */
export async function findEventDraft(id: string): Promise<EventDraft | null> {
  const event = await prisma.event.findFirst({
    where: { id, deletedAt: null },
    include: draftInclude,
  });

  if (event === null) return null;

  return {
    displayName: event.displayName,
    theme: event.theme,
    aboutText: event.aboutText,
    eventDate: event.eventDate,
    timezone: event.timezone,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    venueDescription: event.venueDescription,
    contactEmail: event.contactEmail,
    registrationUrl: event.registrationUrl,
    socialLinks: event.socialLinks,
    heroImage: event.heroImage,
    venueImage: event.venueImage,
    speakers: event.speakers,
    teamMembers: event.teamMembers,
    sponsors: event.sponsors,
    faqs: event.faqs,
  };
}

/** Counts backing the BR-11 limit checks; the limits themselves live in config. */
export async function countEventChildren(eventId: string) {
  const [speakers, teamMembers, sponsors, faqs] = await Promise.all([
    prisma.speaker.count({ where: { eventId } }),
    prisma.teamMember.count({ where: { eventId } }),
    prisma.sponsor.count({ where: { eventId } }),
    prisma.faq.count({ where: { eventId } }),
  ]);

  return { speakers, teamMembers, sponsors, faqs };
}

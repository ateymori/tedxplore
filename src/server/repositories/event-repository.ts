import type { EventDraft } from "@/content/serializer";
import type { Prisma } from "@/generated/prisma/client";
import type { PublicationStatus } from "@/generated/prisma/enums";
import type { TemplateDemoSeed } from "@/templates/contract";

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

/**
 * Everything creating an event needs: the identity fields the organizer chose
 * (FR-8), the licensing attestation (BR-16), and the template's demo content
 * to seed the draft with (FR-10).
 */
export interface CreateEventData {
  ownerId: string;
  slug: string;
  displayName: string;
  templateId: string;
  tedEventUrl: string;
  licenseHolderName: string;
  authorizationConfirmedAt: Date;
  seed: TemplateDemoSeed;
}

/**
 * Creates the event and its seeded draft content in one statement.
 *
 * A nested write rather than a transaction of separate inserts: an event that
 * exists with none of its demo content is a worse outcome than a failed
 * creation the user can retry, and Prisma's nested create is already atomic.
 *
 * Throws Prisma's `P2002` if the slug was claimed between the service's
 * availability check and this insert. That race is real and the unique index
 * is what actually enforces BR-3 — the service catches it and reports
 * `SLUG_TAKEN`, the same result the pre-check would have given.
 */
export async function createEvent(data: CreateEventData) {
  const { seed, ...event } = data;

  return prisma.event.create({
    data: {
      ...event,

      theme: seed.theme,
      aboutText: seed.aboutText,
      eventDate: seed.eventDate,
      timezone: seed.timezone,
      venueName: seed.venueName,
      venueAddress: seed.venueAddress,
      venueDescription: seed.venueDescription,
      contactEmail: seed.contactEmail,
      registrationUrl: seed.registrationUrl,
      socialLinks: seed.socialLinks,

      speakers: { create: seed.speakers },
      teamMembers: { create: seed.teamMembers },
      sponsors: { create: seed.sponsors },
      faqs: { create: seed.faqs },
    },
    select: { id: true, slug: true },
  });
}

/** Task 3.3. The slug is deliberately not updatable here — see `updateEventSlug`. */
export async function updateEventSettings(
  id: string,
  data: { displayName: string; tedEventUrl: string; licenseHolderName: string },
) {
  return prisma.event.update({ where: { id }, data });
}

/**
 * BR-5: scoped to `NEVER_PUBLISHED` so the lock is enforced by the write
 * itself, not only by the service's state check. A slug that has ever been
 * public is permanently frozen, and `count === 0` means the event was
 * published between the check and the update.
 */
export async function updateEventSlug(id: string, slug: string): Promise<boolean> {
  const { count } = await prisma.event.updateMany({
    where: { id, publicationStatus: "NEVER_PUBLISHED", deletedAt: null },
    data: { slug },
  });

  return count > 0;
}

/**
 * FR-13: a draft that was never public leaves no trace — and releases its slug
 * for anyone else to claim (flow 4.3). Cascades remove the draft content,
 * media rows, snapshots, and tokens.
 */
export async function hardDeleteEvent(id: string) {
  await prisma.event.delete({ where: { id } });
}

/**
 * FR-13: an event that has ever been published is retained for audit, so the
 * row (and therefore its slug) stays. The public lookup filters on
 * `deletedAt`, which is what takes the site offline.
 */
export async function softDeleteEvent(id: string) {
  await prisma.event.update({ where: { id }, data: { deletedAt: new Date() } });
}

/**
 * Publication state transitions (BR-6), all scoped to the status the caller
 * believed the event was in.
 *
 * `updateMany` with a `from` filter rather than `update` by id: the service has
 * already applied the rule from `publish-rules.ts`, but between that read and
 * this write an admin may have suspended the event or a review may have
 * approved it. Scoping the write makes the database settle it — `false` means
 * the state moved underneath the caller, which is a result worth reporting, not
 * a lost update to discover later.
 */
async function transitionStatus(
  id: string,
  from: readonly PublicationStatus[],
  data: Prisma.EventUpdateManyMutationInput,
): Promise<boolean> {
  const { count } = await prisma.event.updateMany({
    where: { id, deletedAt: null, publicationStatus: { in: [...from] } },
    data,
  });

  return count > 0;
}

/**
 * FR-35: offline, but the live snapshot pointer is deliberately kept — BR-8a
 * republishing an unchanged snapshot needs no review, and that is only possible
 * if we still know which snapshot it was.
 */
export function unpublishEvent(id: string): Promise<boolean> {
  return transitionStatus(id, ["PUBLISHED"], { publicationStatus: "UNPUBLISHED" });
}

/** BR-8a: back live on the already-approved snapshot, no new review. */
export function republishEvent(id: string): Promise<boolean> {
  return transitionStatus(id, ["UNPUBLISHED"], { publicationStatus: "PUBLISHED" });
}

/**
 * FR-44 / BR-10. Records the status being interrupted in the same statement, so
 * there is no window in which an event is suspended with no memory of where it
 * came back to.
 */
export function suspendEvent(id: string, from: PublicationStatus): Promise<boolean> {
  return transitionStatus(id, ["PUBLISHED", "UNPUBLISHED"], {
    publicationStatus: "SUSPENDED",
    suspendedFromStatus: from,
  });
}

/** BR-10: clears the memory as it uses it, so it can never go stale. */
export function restoreEvent(id: string, to: PublicationStatus): Promise<boolean> {
  return transitionStatus(id, ["SUSPENDED"], {
    publicationStatus: to,
    suspendedFromStatus: null,
  });
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
 * The dashboard's card data (FR-11): identity, publication status, *review*
 * status, and last-edited time.
 *
 * Review status is the most recent publish request, which is not derivable
 * from `publicationStatus` — a published event can have a pending resubmission
 * (FR-31), and a never-published one can carry a rejection the owner still
 * needs to see (FR-33). Fetching only the latest keeps this one query
 * regardless of how many times an event has been through review.
 */
export async function listEventCardsByOwner(ownerId: string) {
  return prisma.event.findMany({
    where: { ownerId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      displayName: true,
      templateId: true,
      publicationStatus: true,
      updatedAt: true,
      publishRequests: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: { status: true, submittedAt: true, rejectionReason: true },
      },
    },
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

/**
 * The admin events index (task 7.6, FR-43).
 *
 * Soft-deleted events are *includable* here — the only query in the app that
 * can see them. FR-13 keeps them for audit precisely so an admin can answer for
 * what was published, and a view that hid them would make that retention
 * pointless. It is opt-in rather than default so the ordinary case isn't
 * cluttered with sites that no longer exist.
 *
 * `ownerIds` is resolved separately (`user-repository.findUserIdsMatching`) and
 * OR'd with the slug match, so one search box means "slug or owner" without a
 * join that would make the two conditions fight over the same index.
 */
export async function searchEvents(options: {
  search?: string;
  ownerIds?: string[];
  includeDeleted?: boolean;
  take?: number;
}) {
  const { search, ownerIds = [], includeDeleted = false, take = 50 } = options;

  const matches =
    search === undefined || search.length === 0
      ? undefined
      : {
          OR: [
            { slug: { contains: search, mode: "insensitive" as const } },
            { displayName: { contains: search, mode: "insensitive" as const } },
            ...(ownerIds.length > 0 ? [{ ownerId: { in: ownerIds } }] : []),
          ],
        };

  return prisma.event.findMany({
    where: {
      ...(includeDeleted ? {} : { deletedAt: null }),
      ...matches,
    },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      slug: true,
      displayName: true,
      publicationStatus: true,
      deletedAt: true,
      updatedAt: true,
      createdAt: true,
      owner: { select: { email: true, name: true } },
      publishRequests: {
        where: { status: "PENDING" },
        select: { id: true },
        take: 1,
      },
    },
  });
}

/**
 * One event with everything the admin detail view shows (FR-43).
 *
 * Unlike `findEventById`, this deliberately does *not* filter `deletedAt`: the
 * whole point of the admin detail view is being able to look at an event that
 * no longer exists publicly.
 */
export async function findEventForAdmin(id: string) {
  return prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      displayName: true,
      templateId: true,
      publicationStatus: true,
      suspendedFromStatus: true,
      liveSnapshotId: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
      tedEventUrl: true,
      licenseHolderName: true,
      authorizationConfirmedAt: true,
      owner: { select: { id: true, email: true, name: true, createdAt: true } },
    },
  });
}

import type { Prisma } from "@/generated/prisma/client";
import type { SponsorTier } from "@/generated/prisma/enums";

import { prisma } from "./prisma";

/**
 * Draft content data access (Phase 5).
 *
 * Like every repository, this layer holds no business rules — no
 * authorization, no limit checks, no state-machine logic. It knows how to
 * write rows and nothing about who may write them (NFR-9).
 *
 * Two conventions run through the whole file:
 *
 *   1. **Every write returns the event's new `updatedAt`.** Autosave needs it
 *      to detect a concurrent session (tech-stack decision 3), and returning it
 *      from the write itself means the value is the one that write produced
 *      rather than whatever a follow-up read happened to see.
 *
 *   2. **Every write touches the event row**, even when the actual change is
 *      to a child table. `Event.updatedAt` is what the dashboard shows as "last
 *      edited" and what the conflict check compares — a draft where adding six
 *      speakers left the timestamp untouched would lie about both.
 */

/** The columns the editor's non-list sections write. */
export interface EventContentFields {
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
  socialLinks: Prisma.InputJsonValue;
}

/**
 * A partial update of the event's own content columns.
 *
 * Partial because the editor saves one section at a time (FR-16): the venue
 * form must not send — and therefore must not be able to blank — the fields it
 * doesn't show. An absent key means "leave alone"; an explicit `null` means
 * "the user cleared it".
 */
export async function updateEventContent(
  eventId: string,
  data: Partial<EventContentFields>,
): Promise<Date> {
  const { updatedAt } = await prisma.event.update({
    where: { id: eventId },
    data,
    select: { updatedAt: true },
  });

  return updatedAt;
}

/** Reads the current concurrency token without loading the draft. */
export async function findEventUpdatedAt(eventId: string): Promise<Date | null> {
  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: { updatedAt: true },
  });

  return event?.updatedAt ?? null;
}

/**
 * Bumps `Event.updatedAt` as part of a child-row write.
 *
 * The timestamp is set explicitly rather than left to `@updatedAt`. Passing an
 * empty `data` looks like it should work — the attribute fires on the update
 * statement — but Prisma elides the statement altogether when there is nothing
 * to set, so the timestamp silently stayed put and adding a speaker left the
 * dashboard claiming the event hadn't been touched in a week. (Verified
 * against Postgres, not reasoned about: the two timestamps came back equal to
 * the millisecond.)
 */
async function touchEvent(tx: Prisma.TransactionClient, eventId: string): Promise<Date> {
  const { updatedAt } = await tx.event.update({
    where: { id: eventId },
    data: { updatedAt: new Date() },
    select: { updatedAt: true },
  });

  return updatedAt;
}

// ---------------------------------------------------------------------------
// List sections
// ---------------------------------------------------------------------------

/**
 * The four operations every list section needs, as plain functions.
 *
 * The obvious implementation — one generic helper that picks a delegate out of
 * `tx` by model name — does not typecheck: Prisma's delegates are each
 * generic in their own args type, and a union of them has no callable
 * signature. Rather than defeat that with casts, each model supplies concrete
 * closures here, so every Prisma call below is fully checked against the real
 * model, and the shared orchestration (transactions, `sortOrder`, touching the
 * event) is written once against this interface.
 *
 * `update` and `remove` return a row count so callers can distinguish "no such
 * row on this event" from a successful write, without a second query.
 */
interface ListOps<Fields> {
  maxSortOrder: (tx: Prisma.TransactionClient, eventId: string) => Promise<number | null>;
  create: (
    tx: Prisma.TransactionClient,
    eventId: string,
    data: Fields,
    sortOrder: number,
  ) => Promise<string>;
  update: (
    tx: Prisma.TransactionClient,
    eventId: string,
    rowId: string,
    data: Fields,
  ) => Promise<number>;
  remove: (tx: Prisma.TransactionClient, eventId: string, rowId: string) => Promise<number>;
  setSortOrder: (
    tx: Prisma.TransactionClient,
    eventId: string,
    rowId: string,
    sortOrder: number,
  ) => Promise<void>;
}

export interface SpeakerFields {
  name: string;
  title: string | null;
  talkTitle: string | null;
  bio: string | null;
  links: Prisma.InputJsonValue;
}

export interface TeamMemberFields {
  name: string;
  role: string | null;
  links: Prisma.InputJsonValue;
}

export interface SponsorFields {
  name: string;
  tier: SponsorTier;
  websiteUrl: string | null;
}

export interface FaqFields {
  question: string;
  answer: string;
}

const speakerOps: ListOps<SpeakerFields> = {
  maxSortOrder: async (tx, eventId) =>
    (await tx.speaker.aggregate({ where: { eventId }, _max: { sortOrder: true } }))._max.sortOrder,
  create: async (tx, eventId, data, sortOrder) =>
    (await tx.speaker.create({ data: { ...data, eventId, sortOrder }, select: { id: true } })).id,
  update: async (tx, eventId, rowId, data) =>
    (await tx.speaker.updateMany({ where: { id: rowId, eventId }, data })).count,
  remove: async (tx, eventId, rowId) =>
    (await tx.speaker.deleteMany({ where: { id: rowId, eventId } })).count,
  setSortOrder: async (tx, eventId, rowId, sortOrder) => {
    await tx.speaker.updateMany({ where: { id: rowId, eventId }, data: { sortOrder } });
  },
};

const teamMemberOps: ListOps<TeamMemberFields> = {
  maxSortOrder: async (tx, eventId) =>
    (await tx.teamMember.aggregate({ where: { eventId }, _max: { sortOrder: true } }))._max
      .sortOrder,
  create: async (tx, eventId, data, sortOrder) =>
    (await tx.teamMember.create({ data: { ...data, eventId, sortOrder }, select: { id: true } }))
      .id,
  update: async (tx, eventId, rowId, data) =>
    (await tx.teamMember.updateMany({ where: { id: rowId, eventId }, data })).count,
  remove: async (tx, eventId, rowId) =>
    (await tx.teamMember.deleteMany({ where: { id: rowId, eventId } })).count,
  setSortOrder: async (tx, eventId, rowId, sortOrder) => {
    await tx.teamMember.updateMany({ where: { id: rowId, eventId }, data: { sortOrder } });
  },
};

const sponsorOps: ListOps<SponsorFields> = {
  maxSortOrder: async (tx, eventId) =>
    (await tx.sponsor.aggregate({ where: { eventId }, _max: { sortOrder: true } }))._max.sortOrder,
  create: async (tx, eventId, data, sortOrder) =>
    (await tx.sponsor.create({ data: { ...data, eventId, sortOrder }, select: { id: true } })).id,
  update: async (tx, eventId, rowId, data) =>
    (await tx.sponsor.updateMany({ where: { id: rowId, eventId }, data })).count,
  remove: async (tx, eventId, rowId) =>
    (await tx.sponsor.deleteMany({ where: { id: rowId, eventId } })).count,
  setSortOrder: async (tx, eventId, rowId, sortOrder) => {
    await tx.sponsor.updateMany({ where: { id: rowId, eventId }, data: { sortOrder } });
  },
};

const faqOps: ListOps<FaqFields> = {
  maxSortOrder: async (tx, eventId) =>
    (await tx.faq.aggregate({ where: { eventId }, _max: { sortOrder: true } }))._max.sortOrder,
  create: async (tx, eventId, data, sortOrder) =>
    (await tx.faq.create({ data: { ...data, eventId, sortOrder }, select: { id: true } })).id,
  update: async (tx, eventId, rowId, data) =>
    (await tx.faq.updateMany({ where: { id: rowId, eventId }, data })).count,
  remove: async (tx, eventId, rowId) =>
    (await tx.faq.deleteMany({ where: { id: rowId, eventId } })).count,
  setSortOrder: async (tx, eventId, rowId, sortOrder) => {
    await tx.faq.updateMany({ where: { id: rowId, eventId }, data: { sortOrder } });
  },
};

// ---------------------------------------------------------------------------
// Shared orchestration
// ---------------------------------------------------------------------------

export interface ListWriteResult {
  id: string;
  updatedAt: Date;
}

/**
 * Appends a row to the end of its list.
 *
 * `max + 1` rather than `count`, because rows get deleted and `count` would
 * then collide with an existing `sortOrder`. Gaps in the sequence are
 * harmless — nothing reads the numbers except an `ORDER BY`.
 */
async function createRow<F>(eventId: string, data: F, ops: ListOps<F>): Promise<ListWriteResult> {
  return prisma.$transaction(async (tx) => {
    const sortOrder = ((await ops.maxSortOrder(tx, eventId)) ?? -1) + 1;
    const id = await ops.create(tx, eventId, data, sortOrder);

    return { id, updatedAt: await touchEvent(tx, eventId) };
  });
}

/**
 * Updates a row, scoped to its event.
 *
 * The `eventId` in the `where` is not redundant with the service's ownership
 * check — it is what makes a mismatched pair (someone else's speaker id, your
 * event id) affect zero rows instead of one. Defence in depth on the write
 * itself, the same reasoning as BR-5's slug lock.
 *
 * `null` means no row matched, which the service reports as `NOT_FOUND`.
 */
async function updateRow<F>(
  eventId: string,
  rowId: string,
  data: F,
  ops: ListOps<F>,
): Promise<Date | null> {
  return prisma.$transaction(async (tx) => {
    const count = await ops.update(tx, eventId, rowId, data);
    if (count === 0) return null;

    return touchEvent(tx, eventId);
  });
}

async function deleteRow<F>(eventId: string, rowId: string, ops: ListOps<F>): Promise<Date | null> {
  return prisma.$transaction(async (tx) => {
    const count = await ops.remove(tx, eventId, rowId);
    if (count === 0) return null;

    return touchEvent(tx, eventId);
  });
}

/**
 * Applies a new order (FR-18).
 *
 * Takes the complete list of ids and assigns positions by array index, so the
 * operation is idempotent: replaying the same drag produces the same result,
 * which matters because a dropped response is indistinguishable from a failed
 * one and the client will retry.
 *
 * Each write is scoped to `eventId`, so an id belonging to another event
 * matches nothing rather than being silently re-parented. Ids the client
 * omitted keep their existing `sortOrder` — an outcome only reachable by a
 * client that sent a partial list, which the editor never does.
 *
 * One transaction, one statement per row. The lists are capped at 30 (BR-11),
 * so a bulk `CASE` expression would trade readability for nothing measurable.
 */
async function reorderRows<F>(eventId: string, ids: string[], ops: ListOps<F>): Promise<Date> {
  return prisma.$transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await ops.setSortOrder(tx, eventId, id, index);
    }

    return touchEvent(tx, eventId);
  });
}

// ---------------------------------------------------------------------------
// Per-model public API
// ---------------------------------------------------------------------------

export const createSpeaker = (eventId: string, data: SpeakerFields) =>
  createRow(eventId, data, speakerOps);
export const updateSpeaker = (eventId: string, id: string, data: SpeakerFields) =>
  updateRow(eventId, id, data, speakerOps);
export const deleteSpeaker = (eventId: string, id: string) => deleteRow(eventId, id, speakerOps);
export const reorderSpeakers = (eventId: string, ids: string[]) =>
  reorderRows(eventId, ids, speakerOps);

export const createTeamMember = (eventId: string, data: TeamMemberFields) =>
  createRow(eventId, data, teamMemberOps);
export const updateTeamMember = (eventId: string, id: string, data: TeamMemberFields) =>
  updateRow(eventId, id, data, teamMemberOps);
export const deleteTeamMember = (eventId: string, id: string) =>
  deleteRow(eventId, id, teamMemberOps);
export const reorderTeamMembers = (eventId: string, ids: string[]) =>
  reorderRows(eventId, ids, teamMemberOps);

export const createSponsor = (eventId: string, data: SponsorFields) =>
  createRow(eventId, data, sponsorOps);
export const updateSponsor = (eventId: string, id: string, data: SponsorFields) =>
  updateRow(eventId, id, data, sponsorOps);
export const deleteSponsor = (eventId: string, id: string) => deleteRow(eventId, id, sponsorOps);
export const reorderSponsors = (eventId: string, ids: string[]) =>
  reorderRows(eventId, ids, sponsorOps);

export const createFaq = (eventId: string, data: FaqFields) => createRow(eventId, data, faqOps);
export const updateFaq = (eventId: string, id: string, data: FaqFields) =>
  updateRow(eventId, id, data, faqOps);
export const deleteFaq = (eventId: string, id: string) => deleteRow(eventId, id, faqOps);
export const reorderFaqs = (eventId: string, ids: string[]) => reorderRows(eventId, ids, faqOps);

import "server-only";
import type { z } from "zod";

import { MAX_FAQS, MAX_SPEAKERS, MAX_SPONSORS, MAX_TEAM_MEMBERS } from "@/config/limits";
import {
  aboutContentSchema,
  contactContentSchema,
  faqContentSchema,
  heroContentSchema,
  registrationContentSchema,
  reorderSchema,
  scheduleContentSchema,
  speakerContentSchema,
  sponsorContentSchema,
  teamMemberContentSchema,
  venueContentSchema,
} from "@/lib/validation/content";
import type { SessionUser } from "@/server/auth";
import * as content from "@/server/repositories/content-repository";
import * as events from "@/server/repositories/event-repository";
import { loadManageable } from "@/server/services/event-service";
import { err, ok, type Result } from "@/server/services/result";
import { parseInput } from "@/server/services/validation";

/**
 * Draft content services (Phase 5).
 *
 * Every function here is the same four steps in the same order: authorize,
 * validate, write, report the new concurrency token. The steps are factored
 * into `saveSection` and the list helpers below rather than repeated eleven
 * times — a section that forgot to authorize would be a silent hole, and there
 * is now exactly one place where authorization can be forgotten.
 *
 * ## Concurrency (tech-stack decision 3)
 *
 * The editor autosaves, so two tabs open on one event is not an exotic case —
 * it is Tuesday. V1's rule is **last-write-wins with a warning**: the write
 * always lands, and the caller is *told* it landed on top of someone else's.
 *
 * Refusing the write instead would be first-write-wins, and would strand the
 * user who is actively typing: their draft would be unsaveable until they
 * reloaded and lost it. That is a worse failure than a stale overwrite the
 * warning invites them to reconcile.
 *
 * This is why these services never return `STALE_WRITE` — the conflict is a
 * successful result carrying a flag, not an error. The variant stays in
 * `DomainError` (and mapped in `form-errors.ts`) for a future editor that can
 * genuinely offer a merge, at which point refusing the write becomes a useful
 * thing to do rather than a dead end.
 */

export interface ContentSaveResult {
  /** The event's new `updatedAt`; the client keeps this as its next token. */
  updatedAt: Date;
  /**
   * Another session wrote between this client's load and this save. The write
   * still happened — this is a prompt to reload, not a failure.
   */
  conflicted: boolean;
}

/**
 * A section save, as the editor sends it.
 *
 * `expectedUpdatedAt` is the token the client last saw. It is optional because
 * a client that has never saved (or a non-form caller) has nothing to compare;
 * absent simply means "don't check", never "assume fresh".
 */
export interface SectionSaveInput {
  values: unknown;
  expectedUpdatedAt?: Date | null;
}

function isConflict(expected: Date | null | undefined, actual: Date): boolean {
  if (expected == null) return false;

  // Postgres stores microseconds and JS `Date` holds milliseconds, so the
  // value that survives a round trip through the client is already truncated.
  // Compare at millisecond resolution or every save would look conflicted.
  return expected.getTime() !== actual.getTime();
}

/**
 * The one path every non-list section takes.
 *
 * `toFields` maps validated input to the subset of columns that section owns.
 * Returning a *partial* is what keeps sections independent: the venue form
 * cannot blank the hero's theme, because the venue's mapper never mentions it.
 */
async function saveSection<S extends z.ZodType>(
  user: SessionUser,
  eventId: string,
  input: SectionSaveInput,
  schema: S,
  toFields: (values: z.output<S>) => Partial<content.EventContentFields>,
): Promise<Result<ContentSaveResult>> {
  const loaded = await loadManageable(user, eventId);
  if (!loaded.ok) return loaded;

  const parsed = parseInput(schema, input.values);
  if (!parsed.ok) return parsed;

  const conflicted = isConflict(input.expectedUpdatedAt, loaded.value.updatedAt);
  const updatedAt = await content.updateEventContent(eventId, toFields(parsed.value));

  return ok({ updatedAt, conflicted });
}

// ---------------------------------------------------------------------------
// Non-list sections (tasks 5.3, 5.6)
// ---------------------------------------------------------------------------

/** FR-15a: `displayName` is required here, as it is on every save. */
export function saveHero(user: SessionUser, eventId: string, input: SectionSaveInput) {
  return saveSection(user, eventId, input, heroContentSchema, (values) => ({
    displayName: values.displayName,
    theme: values.theme,
  }));
}

export function saveAbout(user: SessionUser, eventId: string, input: SectionSaveInput) {
  return saveSection(user, eventId, input, aboutContentSchema, (values) => ({
    aboutText: values.aboutText,
  }));
}

export function saveSchedule(user: SessionUser, eventId: string, input: SectionSaveInput) {
  return saveSection(user, eventId, input, scheduleContentSchema, (values) => ({
    eventDate: values.eventDate,
    timezone: values.timezone,
  }));
}

export function saveContact(user: SessionUser, eventId: string, input: SectionSaveInput) {
  return saveSection(user, eventId, input, contactContentSchema, (values) => ({
    contactEmail: values.contactEmail,
    socialLinks: values.socialLinks,
  }));
}

export function saveRegistration(user: SessionUser, eventId: string, input: SectionSaveInput) {
  return saveSection(user, eventId, input, registrationContentSchema, (values) => ({
    registrationUrl: values.registrationUrl,
  }));
}

export function saveVenue(user: SessionUser, eventId: string, input: SectionSaveInput) {
  return saveSection(user, eventId, input, venueContentSchema, (values) => ({
    venueName: values.venueName,
    venueAddress: values.venueAddress,
    venueDescription: values.venueDescription,
  }));
}

// ---------------------------------------------------------------------------
// List sections (task 5.5)
// ---------------------------------------------------------------------------

/**
 * Which BR-11 limit governs which list, and what to call it in the error.
 *
 * The counts come from `config/limits.ts` — never restated here (invariant 5),
 * so raising a limit is a one-line change in one file.
 */
const LIST_LIMITS = {
  speakers: { max: MAX_SPEAKERS, resource: "speakers" },
  team: { max: MAX_TEAM_MEMBERS, resource: "team members" },
  sponsors: { max: MAX_SPONSORS, resource: "sponsors" },
  faqs: { max: MAX_FAQS, resource: "FAQs" },
} as const;

type ListKey = keyof typeof LIST_LIMITS;

export interface ListItemResult extends ContentSaveResult {
  id: string;
}

/**
 * Adding a row: authorize, validate, then enforce BR-11 before writing.
 *
 * The count is read and checked in the service rather than the database, so
 * two simultaneous adds could in principle both pass a check at limit − 1.
 * Left as-is deliberately: an event has one owner (organizations are out of
 * scope for V1), the window is a few milliseconds, and the consequence is one
 * extra sponsor — while the alternatives are a per-list counter column or a
 * serializable transaction, both real complexity for a rule whose purpose is
 * to keep a page from becoming unusably long.
 */
async function addListItem<S extends z.ZodType, F>(
  user: SessionUser,
  eventId: string,
  input: unknown,
  schema: S,
  list: ListKey,
  toFields: (values: z.output<S>) => F,
  create: (eventId: string, data: F) => Promise<content.ListWriteResult>,
): Promise<Result<ListItemResult>> {
  const loaded = await loadManageable(user, eventId);
  if (!loaded.ok) return loaded;

  const parsed = parseInput(schema, input);
  if (!parsed.ok) return parsed;

  const { max, resource } = LIST_LIMITS[list];
  const counts = await events.countEventChildren(eventId);
  const current = list === "team" ? counts.teamMembers : counts[list];

  if (current >= max) {
    return err({ type: "LIMIT_EXCEEDED", limit: max, resource });
  }

  const { id, updatedAt } = await create(eventId, toFields(parsed.value));

  return ok({ id, updatedAt, conflicted: false });
}

async function updateListItem<S extends z.ZodType, F>(
  user: SessionUser,
  eventId: string,
  rowId: string,
  input: SectionSaveInput,
  schema: S,
  toFields: (values: z.output<S>) => F,
  update: (eventId: string, rowId: string, data: F) => Promise<Date | null>,
): Promise<Result<ContentSaveResult>> {
  const loaded = await loadManageable(user, eventId);
  if (!loaded.ok) return loaded;

  const parsed = parseInput(schema, input.values);
  if (!parsed.ok) return parsed;

  const conflicted = isConflict(input.expectedUpdatedAt, loaded.value.updatedAt);
  const updatedAt = await update(eventId, rowId, toFields(parsed.value));

  // The row is gone — most likely deleted in another tab while this one was
  // still editing it. `NOT_FOUND` is the honest answer and the editor drops
  // the row from its list.
  if (updatedAt === null) return err({ type: "NOT_FOUND", resource: "item" });

  return ok({ updatedAt, conflicted });
}

async function removeListItem(
  user: SessionUser,
  eventId: string,
  rowId: string,
  remove: (eventId: string, rowId: string) => Promise<Date | null>,
): Promise<Result<ContentSaveResult>> {
  const loaded = await loadManageable(user, eventId);
  if (!loaded.ok) return loaded;

  const updatedAt = await remove(eventId, rowId);

  // Deleting something already deleted is the outcome the caller wanted. A
  // double-clicked remove button must not raise an error.
  if (updatedAt === null) {
    return ok({ updatedAt: loaded.value.updatedAt, conflicted: false });
  }

  return ok({ updatedAt, conflicted: false });
}

async function reorderList(
  user: SessionUser,
  eventId: string,
  input: unknown,
  reorder: (eventId: string, ids: string[]) => Promise<Date>,
): Promise<Result<ContentSaveResult>> {
  const loaded = await loadManageable(user, eventId);
  if (!loaded.ok) return loaded;

  const parsed = parseInput(reorderSchema, input);
  if (!parsed.ok) return parsed;

  const updatedAt = await reorder(eventId, parsed.value.ids);

  return ok({ updatedAt, conflicted: false });
}

// --- Speakers --------------------------------------------------------------

export function addSpeaker(user: SessionUser, eventId: string, input: unknown) {
  return addListItem(
    user,
    eventId,
    input,
    speakerContentSchema,
    "speakers",
    (values) => ({
      name: values.name,
      title: values.title,
      talkTitle: values.talkTitle,
      bio: values.bio,
      links: values.links,
    }),
    content.createSpeaker,
  );
}

export function saveSpeaker(
  user: SessionUser,
  eventId: string,
  speakerId: string,
  input: SectionSaveInput,
) {
  return updateListItem(
    user,
    eventId,
    speakerId,
    input,
    speakerContentSchema,
    (values) => ({
      name: values.name,
      title: values.title,
      talkTitle: values.talkTitle,
      bio: values.bio,
      links: values.links,
    }),
    content.updateSpeaker,
  );
}

export function removeSpeaker(user: SessionUser, eventId: string, speakerId: string) {
  return removeListItem(user, eventId, speakerId, content.deleteSpeaker);
}

export function reorderSpeakers(user: SessionUser, eventId: string, input: unknown) {
  return reorderList(user, eventId, input, content.reorderSpeakers);
}

// --- Team ------------------------------------------------------------------

export function addTeamMember(user: SessionUser, eventId: string, input: unknown) {
  return addListItem(
    user,
    eventId,
    input,
    teamMemberContentSchema,
    "team",
    (values) => ({ name: values.name, role: values.role, links: values.links }),
    content.createTeamMember,
  );
}

export function saveTeamMember(
  user: SessionUser,
  eventId: string,
  memberId: string,
  input: SectionSaveInput,
) {
  return updateListItem(
    user,
    eventId,
    memberId,
    input,
    teamMemberContentSchema,
    (values) => ({ name: values.name, role: values.role, links: values.links }),
    content.updateTeamMember,
  );
}

export function removeTeamMember(user: SessionUser, eventId: string, memberId: string) {
  return removeListItem(user, eventId, memberId, content.deleteTeamMember);
}

export function reorderTeamMembers(user: SessionUser, eventId: string, input: unknown) {
  return reorderList(user, eventId, input, content.reorderTeamMembers);
}

// --- Sponsors --------------------------------------------------------------

export function addSponsor(user: SessionUser, eventId: string, input: unknown) {
  return addListItem(
    user,
    eventId,
    input,
    sponsorContentSchema,
    "sponsors",
    (values) => ({ name: values.name, tier: values.tier, websiteUrl: values.websiteUrl }),
    content.createSponsor,
  );
}

export function saveSponsor(
  user: SessionUser,
  eventId: string,
  sponsorId: string,
  input: SectionSaveInput,
) {
  return updateListItem(
    user,
    eventId,
    sponsorId,
    input,
    sponsorContentSchema,
    (values) => ({ name: values.name, tier: values.tier, websiteUrl: values.websiteUrl }),
    content.updateSponsor,
  );
}

export function removeSponsor(user: SessionUser, eventId: string, sponsorId: string) {
  return removeListItem(user, eventId, sponsorId, content.deleteSponsor);
}

export function reorderSponsors(user: SessionUser, eventId: string, input: unknown) {
  return reorderList(user, eventId, input, content.reorderSponsors);
}

// --- FAQs ------------------------------------------------------------------

export function addFaq(user: SessionUser, eventId: string, input: unknown) {
  return addListItem(
    user,
    eventId,
    input,
    faqContentSchema,
    "faqs",
    (values) => ({ question: values.question, answer: values.answer }),
    content.createFaq,
  );
}

export function saveFaq(
  user: SessionUser,
  eventId: string,
  faqId: string,
  input: SectionSaveInput,
) {
  return updateListItem(
    user,
    eventId,
    faqId,
    input,
    faqContentSchema,
    (values) => ({ question: values.question, answer: values.answer }),
    content.updateFaq,
  );
}

export function removeFaq(user: SessionUser, eventId: string, faqId: string) {
  return removeListItem(user, eventId, faqId, content.deleteFaq);
}

export function reorderFaqs(user: SessionUser, eventId: string, input: unknown) {
  return reorderList(user, eventId, input, content.reorderFaqs);
}

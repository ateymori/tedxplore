"use server";

import { revalidatePath } from "next/cache";

import { eventPath } from "@/config/routes";
import { getAuthenticatedUser } from "@/server/auth-guards";
import * as contentService from "@/server/services/content-service";
import * as mediaService from "@/server/services/media-service";
import * as previewLinkService from "@/server/services/preview-link-service";
import type {
  ContentSaveResult,
  ListItemResult,
  SectionSaveInput,
} from "@/server/services/content-service";
import type { Result } from "@/server/services/result";

/**
 * Server Actions for the structured editor (Phase 5).
 *
 * Transport only: authenticate, delegate, return. No rule lives here — a rule
 * in an action is unreachable from the admin area and untestable without Next's
 * runtime (the same reasoning as the Phase 3 actions next door).
 *
 * ## Why nothing calls `revalidatePath`
 *
 * The Phase 3 actions revalidate; these deliberately do not. Autosave fires
 * roughly every 1.5 seconds of typing, and revalidating a path on each one
 * would rebuild the dashboard's payload dozens of times per editing session to
 * update a "last edited" line nobody is looking at.
 *
 * Nothing goes stale as a result. Every page that shows this data —
 * `/dashboard`, the editor, the draft preview — calls a session guard, which
 * reads cookies and so opts the route into dynamic rendering: each visit
 * re-queries. The pages that *are* cached are public event sites, and those
 * render an approved snapshot, not the draft (invariant 3), so a draft edit
 * cannot affect them. Phase 7's approval flow is what revalidates those, and it
 * is the correct place for it.
 *
 * ## `Date` across the boundary
 *
 * `expectedUpdatedAt` and the returned `updatedAt` are real `Date` objects;
 * React's Server Action serialization handles them natively, so the
 * concurrency token never degrades to a string that has to be re-parsed on one
 * side and not the other.
 */

type SaveResult = Promise<Result<ContentSaveResult>>;

// ---------------------------------------------------------------------------
// Sections (tasks 5.3, 5.6)
// ---------------------------------------------------------------------------

export async function saveHeroAction(eventId: string, input: SectionSaveInput): SaveResult {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return contentService.saveHero(auth.value, eventId, input);
}

export async function saveAboutAction(eventId: string, input: SectionSaveInput): SaveResult {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return contentService.saveAbout(auth.value, eventId, input);
}

export async function saveScheduleAction(eventId: string, input: SectionSaveInput): SaveResult {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return contentService.saveSchedule(auth.value, eventId, input);
}

export async function saveContactAction(eventId: string, input: SectionSaveInput): SaveResult {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return contentService.saveContact(auth.value, eventId, input);
}

export async function saveRegistrationAction(eventId: string, input: SectionSaveInput): SaveResult {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return contentService.saveRegistration(auth.value, eventId, input);
}

export async function saveVenueAction(eventId: string, input: SectionSaveInput): SaveResult {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return contentService.saveVenue(auth.value, eventId, input);
}

// ---------------------------------------------------------------------------
// Speakers (task 5.5)
// ---------------------------------------------------------------------------

export async function addSpeakerAction(
  eventId: string,
  input: unknown,
): Promise<Result<ListItemResult>> {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return contentService.addSpeaker(auth.value, eventId, input);
}

export async function saveSpeakerAction(
  eventId: string,
  speakerId: string,
  input: SectionSaveInput,
): SaveResult {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return contentService.saveSpeaker(auth.value, eventId, speakerId, input);
}

export async function removeSpeakerAction(eventId: string, speakerId: string): SaveResult {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return contentService.removeSpeaker(auth.value, eventId, speakerId);
}

export async function reorderSpeakersAction(eventId: string, input: unknown): SaveResult {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return contentService.reorderSpeakers(auth.value, eventId, input);
}

// ---------------------------------------------------------------------------
// Team (task 5.5)
// ---------------------------------------------------------------------------

export async function addTeamMemberAction(
  eventId: string,
  input: unknown,
): Promise<Result<ListItemResult>> {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return contentService.addTeamMember(auth.value, eventId, input);
}

export async function saveTeamMemberAction(
  eventId: string,
  memberId: string,
  input: SectionSaveInput,
): SaveResult {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return contentService.saveTeamMember(auth.value, eventId, memberId, input);
}

export async function removeTeamMemberAction(eventId: string, memberId: string): SaveResult {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return contentService.removeTeamMember(auth.value, eventId, memberId);
}

export async function reorderTeamMembersAction(eventId: string, input: unknown): SaveResult {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return contentService.reorderTeamMembers(auth.value, eventId, input);
}

// ---------------------------------------------------------------------------
// Sponsors (task 5.5)
// ---------------------------------------------------------------------------

export async function addSponsorAction(
  eventId: string,
  input: unknown,
): Promise<Result<ListItemResult>> {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return contentService.addSponsor(auth.value, eventId, input);
}

export async function saveSponsorAction(
  eventId: string,
  sponsorId: string,
  input: SectionSaveInput,
): SaveResult {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return contentService.saveSponsor(auth.value, eventId, sponsorId, input);
}

export async function removeSponsorAction(eventId: string, sponsorId: string): SaveResult {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return contentService.removeSponsor(auth.value, eventId, sponsorId);
}

export async function reorderSponsorsAction(eventId: string, input: unknown): SaveResult {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return contentService.reorderSponsors(auth.value, eventId, input);
}

// ---------------------------------------------------------------------------
// FAQs (task 5.5)
// ---------------------------------------------------------------------------

export async function addFaqAction(
  eventId: string,
  input: unknown,
): Promise<Result<ListItemResult>> {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return contentService.addFaq(auth.value, eventId, input);
}

export async function saveFaqAction(
  eventId: string,
  faqId: string,
  input: SectionSaveInput,
): SaveResult {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return contentService.saveFaq(auth.value, eventId, faqId, input);
}

export async function removeFaqAction(eventId: string, faqId: string): SaveResult {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return contentService.removeFaq(auth.value, eventId, faqId);
}

export async function reorderFaqsAction(eventId: string, input: unknown): SaveResult {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return contentService.reorderFaqs(auth.value, eventId, input);
}

// ---------------------------------------------------------------------------
// Images (task 5.4)
// ---------------------------------------------------------------------------

export async function createImageUploadTicketAction(
  eventId: string,
  slot: unknown,
): Promise<Result<mediaService.UploadTicket>> {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return mediaService.createImageUploadTicket(auth.value, eventId, slot);
}

export async function attachImageAction(
  eventId: string,
  input: unknown,
): Promise<Result<ContentSaveResult & { publicId: string; width: number; height: number }>> {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return mediaService.attachImage(auth.value, eventId, input);
}

export async function removeImageAction(eventId: string, input: unknown): SaveResult {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return mediaService.removeImage(auth.value, eventId, input);
}

// ---------------------------------------------------------------------------
// Preview links (task 6.3)
// ---------------------------------------------------------------------------

/**
 * These two do revalidate, unlike everything above.
 *
 * The exception fits the rule rather than breaking it: the reason autosave
 * doesn't revalidate is that it fires every 1.5 seconds. Issuing or revoking a
 * link is a deliberate, occasional act, and the editor page server-renders the
 * current link — so without this, navigating away and back would show a link
 * that no longer works, or none where one now exists.
 */

export async function issuePreviewLinkAction(
  eventId: string,
): Promise<Result<previewLinkService.PreviewLink>> {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  const result = await previewLinkService.issuePreviewLink(auth.value, eventId);
  if (result.ok) revalidatePath(eventPath(eventId));

  return result;
}

export async function revokePreviewLinkAction(
  eventId: string,
): Promise<Result<{ revoked: number }>> {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  const result = await previewLinkService.revokePreviewLink(auth.value, eventId);
  if (result.ok) revalidatePath(eventPath(eventId));

  return result;
}

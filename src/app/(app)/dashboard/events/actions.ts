"use server";

import { revalidatePath } from "next/cache";

import { DASHBOARD_PATH, eventSettingsPath } from "@/config/routes";
import { getAuthenticatedUser } from "@/server/auth-guards";
import * as eventService from "@/server/services/event-service";
import type { Result } from "@/server/services/result";

/**
 * Server Actions for event management (Phase 3).
 *
 * Each one does the same three things in the same order: authenticate,
 * delegate to the service, revalidate what changed. No business logic lives
 * here — actions are a transport, and putting a rule in one would make it
 * unreachable from the admin area and untestable without Next's runtime.
 *
 * They return `Result` rather than redirecting: the caller is a form that must
 * render field errors, and a redirect mid-mutation would discard them. Success
 * navigation is the client's job.
 */

export async function createEventAction(
  input: unknown,
): Promise<Result<eventService.EventSummary>> {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  const result = await eventService.createEvent(auth.value, input);
  if (result.ok) revalidatePath(DASHBOARD_PATH);

  return result;
}

/**
 * Backs the create form's live availability indicator.
 *
 * Authenticated like every other action — it is a database read triggered by
 * keystrokes, and leaving it open would make it a free slug-enumeration
 * endpoint even though slugs are public URLs.
 */
export async function checkSlugAvailabilityAction(
  slug: string,
): Promise<Result<eventService.SlugAvailability>> {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  return eventService.checkSlugAvailability({ slug });
}

export async function updateEventSettingsAction(
  eventId: string,
  input: unknown,
): Promise<Result<eventService.EventSummary>> {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  const result = await eventService.updateEventSettings(auth.value, eventId, input);

  if (result.ok) {
    revalidatePath(DASHBOARD_PATH);
    revalidatePath(eventSettingsPath(eventId));
  }

  return result;
}

export async function changeEventSlugAction(
  eventId: string,
  input: unknown,
): Promise<Result<eventService.EventSummary>> {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  const result = await eventService.changeEventSlug(auth.value, eventId, input);

  if (result.ok) {
    revalidatePath(DASHBOARD_PATH);
    revalidatePath(eventSettingsPath(eventId));
  }

  return result;
}

export async function deleteEventAction(
  eventId: string,
): Promise<Result<eventService.DeletionResult>> {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return auth;

  const result = await eventService.deleteEvent(auth.value, eventId);
  if (result.ok) revalidatePath(DASHBOARD_PATH);

  return result;
}

import "server-only";

import type { SessionUser } from "@/server/auth";
import { canManageEvent } from "@/server/services/authorization";
import { changeSlugSchema, createEventSchema, eventSettingsSchema } from "@/lib/validation/event";
import * as events from "@/server/repositories/event-repository";
import { isUniqueConstraintError } from "@/server/repositories/prisma";
import { deletionMode, isSlugEditable } from "@/server/services/event-rules";
import { err, ok, type Result } from "@/server/services/result";
import { parseInput } from "@/server/services/validation";
import { findTemplate } from "@/templates/registry";

/**
 * Event lifecycle services (Phase 3).
 *
 * Every mutation here authorizes before it writes (architectural invariant 6)
 * and validates server-side regardless of what the client already checked
 * (NFR-5). Callers get a `Result` — Server Actions must render an error, not
 * receive a redirect mid-mutation.
 */

export interface EventSummary {
  id: string;
  slug: string;
}

/**
 * Loads an event and checks the caller may manage it (invariant 6).
 *
 * Exported because pages need it too — a settings page must apply the same
 * ownership rule as the action it submits to, and having one function do it
 * means the page and the mutation can never disagree about who may see what.
 *
 * `NOT_FOUND` is returned for an event owned by someone else, not `FORBIDDEN`:
 * confirming that an id exists is itself information, and an organizer probing
 * ids should learn nothing from the difference. An admin, who is allowed to
 * know, gets the real answer.
 */
export async function loadManageable(
  user: SessionUser,
  eventId: string,
): Promise<Result<NonNullable<Awaited<ReturnType<typeof events.findEventById>>>>> {
  const event = await events.findEventById(eventId);

  if (event === null || !canManageEvent(user, event.ownerId)) {
    return err({ type: "NOT_FOUND", resource: "event" });
  }

  return ok(event);
}

/**
 * FR-7/FR-8/FR-9/FR-10: create a draft event.
 *
 * The slug is reserved by the insert itself. The pre-check below exists only
 * to produce a friendly error before doing work; the unique index is the
 * actual enforcement of BR-3, which is why the `P2002` path returns the same
 * result rather than surfacing a server error.
 */
export async function createEvent(
  user: SessionUser,
  input: unknown,
  now: Date = new Date(),
): Promise<Result<EventSummary>> {
  const parsed = parseInput(createEventSchema, input);
  if (!parsed.ok) return parsed;

  const { slug, displayName, templateId, tedEventUrl, licenseHolderName } = parsed.value;

  const template = findTemplate(templateId);
  // Unreachable through the schema, which already rejects unknown ids; kept so
  // the non-null assertion the seed would otherwise need doesn't exist.
  if (template === null) {
    return err({ type: "VALIDATION_FAILED", issues: { templateId: ["Choose a template."] } });
  }

  if (await events.isSlugTaken(slug)) {
    return err({ type: "SLUG_TAKEN" });
  }

  try {
    const created = await events.createEvent({
      ownerId: user.id,
      slug,
      displayName,
      templateId: template.id,
      tedEventUrl,
      licenseHolderName,
      // BR-16: the server's clock, never a client-supplied timestamp — this is
      // an attestation, and its value is the moment we observed the user make
      // it.
      authorizationConfirmedAt: now,
      seed: template.demoSeed(now),
    });

    return ok(created);
  } catch (error) {
    if (isUniqueConstraintError(error)) return err({ type: "SLUG_TAKEN" });
    throw error;
  }
}

export type SlugAvailability = "AVAILABLE" | "TAKEN";

/**
 * The create form's live availability check (task 3.1).
 *
 * Format and reserved-word rules are the schema's job and are already checked
 * on the client, so this only answers the question that needs a database. A
 * malformed slug returns its validation issues rather than a bare "taken", so
 * the caller never has to guess why an answer was refused.
 *
 * This does leak whether a slug exists — but a slug *is* a public URL, so
 * anyone can learn the same thing by visiting it.
 */
export async function checkSlugAvailability(input: unknown): Promise<Result<SlugAvailability>> {
  const parsed = parseInput(changeSlugSchema, input);
  if (!parsed.ok) return parsed;

  return ok((await events.isSlugTaken(parsed.value.slug)) ? "TAKEN" : "AVAILABLE");
}

/** Task 3.3: display name and licensing info, editable at any time. */
export async function updateEventSettings(
  user: SessionUser,
  eventId: string,
  input: unknown,
): Promise<Result<EventSummary>> {
  const loaded = await loadManageable(user, eventId);
  if (!loaded.ok) return loaded;

  const parsed = parseInput(eventSettingsSchema, input);
  if (!parsed.ok) return parsed;

  const updated = await events.updateEventSettings(eventId, parsed.value);
  return ok({ id: updated.id, slug: updated.slug });
}

/**
 * Task 3.3 / BR-5: change the slug, allowed only before first publication.
 *
 * The state check here produces the friendly error; the repository's write is
 * scoped to `NEVER_PUBLISHED` as well, so an event that gets published between
 * the two still cannot have its URL changed.
 */
export async function changeEventSlug(
  user: SessionUser,
  eventId: string,
  input: unknown,
): Promise<Result<EventSummary>> {
  const loaded = await loadManageable(user, eventId);
  if (!loaded.ok) return loaded;

  const event = loaded.value;

  if (!isSlugEditable(event.publicationStatus)) {
    return err({ type: "SLUG_LOCKED" });
  }

  const parsed = parseInput(changeSlugSchema, input);
  if (!parsed.ok) return parsed;

  const { slug } = parsed.value;
  if (slug === event.slug) return ok({ id: event.id, slug });

  if (await events.isSlugTaken(slug)) {
    return err({ type: "SLUG_TAKEN" });
  }

  try {
    const changed = await events.updateEventSlug(eventId, slug);
    if (!changed) return err({ type: "SLUG_LOCKED" });
  } catch (error) {
    if (isUniqueConstraintError(error)) return err({ type: "SLUG_TAKEN" });
    throw error;
  }

  return ok({ id: eventId, slug });
}

export interface DeletionResult {
  slug: string;
  mode: ReturnType<typeof deletionMode>;
}

/**
 * FR-13: delete an event, hard or soft depending on whether it was ever
 * published. The confirmation step is the caller's (UI) responsibility; by the
 * time this runs the decision is final.
 */
export async function deleteEvent(
  user: SessionUser,
  eventId: string,
): Promise<Result<DeletionResult>> {
  const loaded = await loadManageable(user, eventId);
  if (!loaded.ok) return loaded;

  const event = loaded.value;
  const mode = deletionMode(event.publicationStatus);

  if (mode === "HARD") {
    await events.hardDeleteEvent(eventId);
  } else {
    await events.softDeleteEvent(eventId);
  }

  return ok({ slug: event.slug, mode });
}

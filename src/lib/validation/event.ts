import { z } from "zod";

import { LICENSE_HOLDER_NAME_MAX_LENGTH } from "@/config/limits";
import { displayNameSchema } from "@/lib/validation/display-name";
import { slugSchema } from "@/lib/validation/slug";
import { externalUrlSchema } from "@/lib/validation/url";
import { isTemplateId } from "@/templates/registry";

/**
 * Event creation and settings (FR-8, BR-16).
 *
 * Shared by the client form and the server action, so the message a user reads
 * inline is the same one the server would produce — client validation is UX
 * only, never the boundary (NFR-5).
 */

/**
 * The license holder / lead organizer named on the TEDx license (BR-16).
 *
 * Not `displayNameSchema`: this is a *person or organization*, and the display
 * name's no-digits rule exists for event names, not people. Nothing here is
 * verified automatically — an admin reads it during review (A-2) — so the
 * validation is a plain non-blank length bound rather than an attempt to
 * decide what a real name looks like.
 */
export const licenseHolderNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Enter the name on the TEDx license." })
  .max(LICENSE_HOLDER_NAME_MAX_LENGTH, {
    error: `Must be at most ${LICENSE_HOLDER_NAME_MAX_LENGTH} characters.`,
  });

/**
 * The official TED event page (BR-16).
 *
 * Deliberately not restricted to a `ted.com` host. V1 treats licensing as a
 * manual admin responsibility (A-2), and a hostname allowlist would reject
 * legitimate variants — regional TED domains, shortened links an organizer was
 * given — while doing nothing about the real risk, which is a well-formed URL
 * pointing at someone else's event. The admin review panel shows this value
 * verbatim for exactly that reason.
 */
export const tedEventUrlSchema = externalUrlSchema;

const templateIdSchema = z.string().refine(isTemplateId, {
  error: "Choose a template.",
});

/**
 * The authorization affirmation (FR-8, BR-16).
 *
 * The refinement — rather than `z.literal(true)` — is what lets the form start
 * with an unchecked box: `literal(true)` would make `false` unrepresentable in
 * the schema's input type, so the form's own default value wouldn't typecheck.
 * An unchecked box is still a validation failure with its own message, never a
 * `false` the server has to remember to reject.
 *
 * The timestamp stored on the event is the server's clock at creation, never a
 * client-supplied one.
 */
const authorizationConfirmedSchema = z.boolean().refine((confirmed) => confirmed, {
  error: "You must confirm you are authorized to represent this event.",
});

export const createEventSchema = z.object({
  slug: slugSchema,
  displayName: displayNameSchema,
  templateId: templateIdSchema,
  tedEventUrl: tedEventUrlSchema,
  licenseHolderName: licenseHolderNameSchema,
  authorizationConfirmed: authorizationConfirmedSchema,
});

export type CreateEventInput = z.infer<typeof createEventSchema>;

/**
 * Settings editable after creation (task 3.3).
 *
 * The slug is absent on purpose — it follows different rules (BR-5: editable
 * only before first publication) and so gets its own schema and its own
 * action, which cannot be reached at all once the event is locked.
 */
export const eventSettingsSchema = z.object({
  displayName: displayNameSchema,
  tedEventUrl: tedEventUrlSchema,
  licenseHolderName: licenseHolderNameSchema,
});

export type EventSettingsInput = z.infer<typeof eventSettingsSchema>;

export const changeSlugSchema = z.object({ slug: slugSchema });

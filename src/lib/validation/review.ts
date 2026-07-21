import { z } from "zod";

import { REJECTION_REASON_MAX_LENGTH, REJECTION_REASON_MIN_LENGTH } from "@/config/limits";

/**
 * Admin review inputs (Phase 7).
 *
 * Shared by the admin forms and the services behind them, so the message a
 * reviewer sees while typing is the same rule the server applies.
 */

/**
 * FR-33: a rejection reason is required, and required to be *useful*.
 *
 * The minimum length is the interesting part. "no" clears a `nonempty()` check
 * and tells the organizer nothing, and this text is the entire body of the
 * email they receive — it is the only thing standing between them and guessing.
 * A floor of a few words is a crude proxy for effort, but it is the one the
 * form can enforce, and the cost of it is a reviewer occasionally padding a
 * genuinely short reason.
 */
export const rejectionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(
      REJECTION_REASON_MIN_LENGTH,
      `Explain what needs to change — at least ${REJECTION_REASON_MIN_LENGTH} characters, so the organizer knows what to fix.`,
    )
    .max(
      REJECTION_REASON_MAX_LENGTH,
      `Keep the reason under ${REJECTION_REASON_MAX_LENGTH} characters.`,
    ),
});

export type RejectionInput = z.infer<typeof rejectionSchema>;

/**
 * FR-44: a suspension reason is optional, unlike a rejection's.
 *
 * The asymmetry is deliberate. A rejection is a review decision that is
 * worthless without its explanation; a suspension may be an urgent response to
 * abuse, and a required field would make the fastest possible action slower. An
 * empty string normalizes to `null` so the email template can omit the block
 * entirely rather than render an empty quote.
 */
export const suspensionSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(
      REJECTION_REASON_MAX_LENGTH,
      `Keep the reason under ${REJECTION_REASON_MAX_LENGTH} characters.`,
    )
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .default(null),
});

export type SuspensionInput = z.infer<typeof suspensionSchema>;

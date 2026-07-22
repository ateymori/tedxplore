import { z } from "zod";

import { REPORT_EXPLANATION_MAX_LENGTH, REPORT_EXPLANATION_MIN_LENGTH } from "@/config/limits";

/**
 * Public site reports (FR-45..FR-47, Phase 9).
 *
 * Shared by the report dialog and the route handler behind it, so the message
 * a reporter sees while typing is the same rule the server applies.
 *
 * This is the only form in the product filled in by someone with no account,
 * which changes the tone of the validation: every rule here is a barrier
 * between a stranger and telling us something is wrong. Anything not strictly
 * needed to act on the report is optional.
 */

/** Mirrors the `ReportCategory` enum in the Prisma schema (FR-46). */
export const reportCategorySchema = z.enum([
  "IMPERSONATION",
  "INAPPROPRIATE_CONTENT",
  "SPAM_OR_SCAM",
  "COPYRIGHT",
  "OTHER",
]);

export type ReportCategory = z.infer<typeof reportCategorySchema>;

/**
 * The labels the reporter actually reads.
 *
 * Written from the visitor's point of view, not the schema's: someone who
 * landed on a fake TEDx site is not thinking "impersonation", they are
 * thinking "these people don't have permission to run this".
 */
export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  IMPERSONATION: "Not an authorized TEDx event",
  INAPPROPRIATE_CONTENT: "Inappropriate or offensive content",
  SPAM_OR_SCAM: "Spam or a scam",
  COPYRIGHT: "Uses content without permission",
  OTHER: "Something else",
};

/**
 * The honeypot field.
 *
 * Named to look worth filling in to a bot skimming the DOM for something to
 * complete, and hidden from people with CSS *and* `aria-hidden` + `tabIndex:
 * -1` so a screen-reader user is never asked to fill in an invisible field.
 * A submission that carries any value here is discarded (FR-47).
 *
 * Deliberately part of the shared schema rather than a check bolted onto the
 * handler: the field has to exist in the form markup and be rejected by the
 * server, and keeping both facts in one place is what stops someone "tidying
 * up" the unused-looking input later.
 */
export const REPORT_HONEYPOT_FIELD = "website";

/**
 * What the browser binds to and submits.
 *
 * Deliberately transform-free and all-strings — the same split Phase 5 made
 * between the editor's wire format and `EventContent`, for the same two
 * reasons:
 *
 *   1. A controlled input needs a string, and a schema whose input and output
 *      types differ cannot be bound by React Hook Form at all.
 *   2. **The honeypot must not be validated here.** A bot that fills it should
 *      be accepted by the form and discarded by the server, silently. Enforcing
 *      `max(0)` client-side would show the bot a validation error and teach it
 *      which field to leave alone — turning the trap into a tutorial.
 */
export const reportFormSchema = z.object({
  /**
   * Which site is being reported. The slug, not the event id: the reporter's
   * browser knows the URL it is on and nothing else, and the id is not
   * something a public page should be handing out.
   */
  slug: z.string().min(1),

  category: reportCategorySchema,

  explanation: z
    .string()
    .trim()
    .min(
      REPORT_EXPLANATION_MIN_LENGTH,
      `Please add a little detail — at least ${REPORT_EXPLANATION_MIN_LENGTH} characters.`,
    )
    .max(
      REPORT_EXPLANATION_MAX_LENGTH,
      `Please keep this under ${REPORT_EXPLANATION_MAX_LENGTH} characters.`,
    ),

  /**
   * Optional, and it must stay optional (FR-46).
   *
   * Requiring an address would filter reports down to people willing to
   * identify themselves to the platform hosting the site they are objecting
   * to — exactly the wrong selection.
   */
  reporterEmail: z.union([z.literal(""), z.email("That doesn't look like an email address.")]),

  [REPORT_HONEYPOT_FIELD]: z.string(),
});

export type ReportFormValues = z.infer<typeof reportFormSchema>;

/**
 * What the server accepts (task 9.2).
 *
 * The form schema, plus normalizing a blank email to `null` so the admin inbox
 * renders "no reply address" rather than an empty string.
 *
 * **The honeypot is deliberately not rejected here.** It is tempting to write
 * `z.string().max(0)` and be done — but a schema failure is a `400`, while a
 * real report is a `202`, and that difference is precisely the signal a bot
 * needs to discover which field to stop filling in. The trap has to be
 * accepted by validation and discarded *silently* by `report-service.ts`, so
 * that every outcome a bot can observe looks like success.
 *
 * (Written the wrong way first; `scripts/archive/verify-9-2.ts` caught the 400.)
 */
export const reportSubmissionSchema = reportFormSchema.extend({
  reporterEmail: z
    .union([z.literal(""), z.email()])
    .transform((value) => (value === "" ? null : value)),
});

export type ReportSubmission = z.infer<typeof reportSubmissionSchema>;

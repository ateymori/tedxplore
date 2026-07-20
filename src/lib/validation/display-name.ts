import { z } from "zod";

import { DISPLAY_NAME_MAX_LENGTH } from "@/config/limits";

/**
 * Display Name validation (BR-5a..BR-5c).
 *
 * Display Name is the human-readable event name shown in the nav, page title,
 * and Hero (e.g. "TEDxMcGill University"). Unlike the slug it is not unique,
 * not part of any URL, and stays freely editable after publication — but it
 * is the one field that can never be saved blank (FR-15a).
 */

/**
 * BR-5b: letters of any case, spaces, and hyphens.
 *
 * `\p{L}` covers accented and non-Latin letters; `\p{M}` covers standalone
 * combining marks, so a decomposed "é" (e + U+0301) validates the same as its
 * precomposed form. Digits are excluded by construction.
 */
const DISPLAY_NAME_PATTERN = /^[\p{L}\p{M}\p{Zs} -]+$/u;

const CONTAINS_DIGIT = /\p{Nd}/u;

export const displayNameSchema = z
  .string()
  .trim()
  // Unicode input reaches us in whichever normalization form the user's
  // keyboard or paste source produced. Normalizing to NFC on the way in keeps
  // visually identical names byte-identical in the database and in snapshots.
  .transform((value) => value.normalize("NFC"))
  .pipe(
    z
      .string()
      .refine((value) => value.length > 0, {
        error: "Display name is required.",
      })
      .refine((value) => value.length <= DISPLAY_NAME_MAX_LENGTH, {
        error: `Must be at most ${DISPLAY_NAME_MAX_LENGTH} characters.`,
      })
      // Checked before the general charset rule: "TEDx2025" is a common and
      // specific mistake that deserves a specific message.
      .refine((value) => !CONTAINS_DIGIT.test(value), {
        error: "Display name can't contain numbers.",
      })
      .refine((value) => DISPLAY_NAME_PATTERN.test(value), {
        error: "Use letters, spaces, and hyphens only.",
      }),
  );

export function isValidDisplayName(value: string): boolean {
  return displayNameSchema.safeParse(value).success;
}

/**
 * BR-5c: the value the create-event form pre-fills once a slug is entered.
 *
 * Deliberately naive — `TEDx` plus the slug with its first letter capitalized
 * (`mcgillu` → `TEDxMcgillu`). The slug carries no word boundaries, so there
 * is nothing to infer proper casing or spacing from; users are expected to
 * overwrite this with the real name ("TEDxMcGill University"). It is a
 * starting point, not a guess at the answer.
 */
export function suggestDisplayName(slug: string): string {
  const trimmed = slug.trim();
  if (trimmed.length === 0) return "";
  return `TEDx${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

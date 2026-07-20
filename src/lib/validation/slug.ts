import { z } from "zod";

import { SLUG_MAX_LENGTH, SLUG_MIN_LENGTH } from "@/config/limits";
import { isReservedSlug } from "@/config/reserved-slugs";

/**
 * Slug validation (BR-1..BR-5).
 *
 * The slug exists for exactly one purpose: building the public URL
 * `/tedx{slug}`. It is never displayed as the event's name — that is Display
 * Name's job (see `./display-name.ts`). The two fields have unrelated
 * charsets and unrelated rules, so they are deliberately kept as separate
 * validators rather than one derived from the other.
 */

/** BR-1: lowercase `a–z` only — no uppercase, digits, hyphens, or spaces. */
const SLUG_PATTERN = /^[a-z]+$/;

export const slugSchema = z
  .string()
  .trim()
  // Charset is checked before length so that "TEDx-2025" reports the real
  // problem (invalid characters) rather than an incidental length error.
  .refine((value) => SLUG_PATTERN.test(value), {
    error: "Use lowercase letters a–z only — no capitals, numbers, spaces, or hyphens.",
  })
  .refine((value) => value.length >= SLUG_MIN_LENGTH, {
    error: `Must be at least ${SLUG_MIN_LENGTH} characters.`,
  })
  .refine((value) => value.length <= SLUG_MAX_LENGTH, {
    error: `Must be at most ${SLUG_MAX_LENGTH} characters.`,
  })
  .refine((value) => !isReservedSlug(value), {
    error: "That address is reserved. Please choose another.",
  });

/**
 * BR-3 uniqueness is *not* checked here — it needs a database round trip and
 * lives in the event service. This covers only the rules that are decidable
 * from the value alone.
 */
export function isValidSlug(value: string): boolean {
  return slugSchema.safeParse(value).success;
}

import { randomBytes } from "node:crypto";

import { PREVIEW_TOKEN_BYTES } from "@/config/limits";

/**
 * Preview-link tokens (FR-25, tech-stack decision 6).
 *
 * `PREVIEW_TOKEN_BYTES` bytes from `crypto.randomBytes`, rendered base64url so
 * the value survives a URL path segment without escaping. 256 bits is not
 * negotiable (NFR-5) and is why the byte count lives in `config/limits.ts`
 * rather than here.
 *
 * The token is stored as-is rather than hashed. That is a deliberate departure
 * from how we treat password-reset tokens: this one gates a *read-only view of
 * the owner's own draft*, not an account or a mutation, and the owner needs to
 * be able to re-read the link they created in order to share it again. Hashing
 * would mean showing it exactly once, which is the wrong trade for a link whose
 * entire job is being pasted into a group chat.
 *
 * Kept free of `server-only` and of any database import so the shape check can
 * run in a unit test — and, more importantly, so the route can reject a
 * malformed token without a query.
 */

/**
 * Length of the base64url encoding of `PREVIEW_TOKEN_BYTES` bytes, unpadded:
 * every 3 bytes become 4 characters, with a partial group rounding up.
 */
export const PREVIEW_TOKEN_LENGTH = Math.ceil((PREVIEW_TOKEN_BYTES * 4) / 3);

const PREVIEW_TOKEN_PATTERN = new RegExp(`^[A-Za-z0-9_-]{${PREVIEW_TOKEN_LENGTH}}$`);

export function generatePreviewToken(): string {
  return randomBytes(PREVIEW_TOKEN_BYTES).toString("base64url");
}

/**
 * Whether a value could be a token we issued.
 *
 * Not a security check — it proves nothing about whether the token is real or
 * active, which only the database can answer. It exists so that `/preview/x`
 * and every crawler probing the namespace are refused without a round trip,
 * which is also what keeps Phase 9.4's rate limiter measuring guesses at real
 * tokens instead of noise.
 */
export function isPreviewTokenShaped(value: string): boolean {
  return PREVIEW_TOKEN_PATTERN.test(value);
}

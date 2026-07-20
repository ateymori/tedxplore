// Post-authentication redirect targets (task 2.4).
//
// `returnTo` is attacker-controllable: it arrives in a query string that anyone
// can put in a link. Everything here exists to guarantee that a value which
// survives `sanitizeReturnTo` can only ever navigate within this application —
// an open redirect on a login page is a phishing primitive, since the victim
// sees a genuine tedxplore.com link and lands somewhere else already trusting
// the page.

import { DEFAULT_AUTHENTICATED_PATH, LOGIN_PATH, RETURN_TO_PARAM } from "@/config/routes";

/**
 * Reduces an untrusted `returnTo` to a same-origin path, or `null` if it can't
 * be trusted.
 *
 * Accepts only root-relative paths. Absolute URLs are rejected outright rather
 * than compared against an allowlist of hosts, because URL parsing differences
 * between the checker and the browser are exactly where open-redirect bugs
 * live.
 */
export function sanitizeReturnTo(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.length === 0) return null;

  // Control characters (notably \n, \r, \t) are stripped or ignored by browsers
  // when resolving a URL, so `/\tevil.com` can parse differently than it reads.
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;

  if (!value.startsWith("/")) return null;

  // `//evil.com` and `/\evil.com` are protocol-relative URLs, not local paths.
  if (value.startsWith("//") || value.startsWith("/\\")) return null;

  // A backslash anywhere in the authority position is normalized to `/` by
  // browsers; refuse the whole class rather than reason about position.
  if (value.includes("\\")) return null;

  return value;
}

/** `sanitizeReturnTo` with the default destination substituted for failures. */
export function resolveReturnTo(
  value: string | null | undefined,
  fallback: string = DEFAULT_AUTHENTICATED_PATH,
): string {
  return sanitizeReturnTo(value) ?? fallback;
}

/**
 * Builds `/login?returnTo=…` for an unauthenticated visitor to `pathname`.
 *
 * The parameter is omitted when the destination is the default anyway, so the
 * common case stays a clean `/login`.
 */
export function loginPathWithReturnTo(
  pathname: string | null | undefined,
  loginPath: string = LOGIN_PATH,
): string {
  const target = sanitizeReturnTo(pathname);
  if (target === null || target === DEFAULT_AUTHENTICATED_PATH) return loginPath;

  const params = new URLSearchParams({ [RETURN_TO_PARAM]: target });
  return `${loginPath}?${params.toString()}`;
}

/** Carries an existing `returnTo` across the login ↔ sign-up switch. */
export function withReturnTo(path: string, returnTo: string | null | undefined): string {
  const target = sanitizeReturnTo(returnTo);
  if (target === null) return path;

  const params = new URLSearchParams({ [RETURN_TO_PARAM]: target });
  return `${path}?${params.toString()}`;
}

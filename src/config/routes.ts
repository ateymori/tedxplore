// Application route constants and the access rules that go with them.
//
// Defined once so the proxy, the server-side guards, and every link in the UI
// agree on what a path is called and whether it needs a session. Public event
// sites are deliberately absent: they live under the `[site]` catch-all and are
// never gated (see `config/site.ts`).

// Relative, not aliased: `next.config.ts` imports `PREVIEW_PATH_PREFIX` from
// this module to build the `X-Robots-Tag` rule, and the config is loaded
// outside the app's module graph, where `@/` does not resolve.
import { APP_URL } from "./site";

export const HOME_PATH = "/";

export const LOGIN_PATH = "/login";
export const SIGNUP_PATH = "/signup";
export const VERIFY_EMAIL_PATH = "/verify-email";
export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const RESET_PASSWORD_PATH = "/reset-password";

export const DASHBOARD_PATH = "/dashboard";
export const ADMIN_PATH = "/admin";

/**
 * Event management lives under `/dashboard`, which is already a protected
 * prefix — so every page below is gated by the same rule, and adding one can't
 * accidentally create an unguarded route. (The guards are still the real
 * boundary; see `server/auth-guards.ts`.)
 */
export const NEW_EVENT_PATH = `${DASHBOARD_PATH}/events/new`;

/** Selects which template a new event starts from (FR-51). */
export const TEMPLATE_PARAM = "template";

export function newEventPath(templateId?: string): string {
  return templateId
    ? `${NEW_EVENT_PATH}?${TEMPLATE_PARAM}=${encodeURIComponent(templateId)}`
    : NEW_EVENT_PATH;
}

/** The structured editor for one event (Phase 5). */
export function eventPath(eventId: string): string {
  return `${DASHBOARD_PATH}/events/${eventId}`;
}

export function eventSettingsPath(eventId: string): string {
  return `${eventPath(eventId)}/settings`;
}

/**
 * The owner's draft preview (FR-24, task 5.7).
 *
 * Deliberately *not* under `/dashboard`: that prefix carries the application
 * chrome — nav, constrained `<main>` — and the whole promise of this page is
 * that it is identical to the published site. A route outside the `(app)`
 * group is the only way to escape a parent layout in the App Router.
 *
 * It shares the `/preview` namespace with Phase 6's tokenized links
 * (`/preview/[token]`). `draft` is a static segment, so it always wins against
 * the dynamic one — and grouping the two means both can share the same
 * `noindex` rules and rendering path as Phase 6 builds out.
 */
export function eventPreviewPath(eventId: string): string {
  return `${PREVIEW_PATH_PREFIX}/draft/${eventId}`;
}

/**
 * The `/preview` namespace, named once because `next.config.ts` has to match it
 * too: every response below this prefix carries `X-Robots-Tag: noindex` (FR-27),
 * and a header rule that drifted from the routes would silently start letting
 * unpublished drafts into search results.
 */
export const PREVIEW_PATH_PREFIX = "/preview";

/**
 * A shareable, tokenized draft preview (FR-25).
 *
 * The token *is* the credential, so this path is never gated — which is
 * precisely why it lives outside `PROTECTED_PREFIXES` and why the token is
 * 256 bits (`lib/preview-token.ts`).
 */
export function previewLinkPath(token: string): string {
  return `${PREVIEW_PATH_PREFIX}/${token}`;
}

/**
 * The absolute form, which is the only useful one: this link exists to be
 * copied out of the app and pasted somewhere else.
 */
export function previewLinkUrl(token: string): string {
  return `${APP_URL}${previewLinkPath(token)}`;
}

/**
 * A template's Live Preview (FR-50) — its `demoContent` rendered through the
 * real public renderer.
 *
 * Public and unauthenticated by design: the whole point is that a visitor can
 * see what they would get before deciding to sign up, and can leave without
 * ever creating an account.
 */
export function templatePreviewPath(templateId: string): string {
  return `/templates/${encodeURIComponent(templateId)}/preview`;
}

/** Query parameter carrying the post-authentication destination (task 2.4). */
export const RETURN_TO_PARAM = "returnTo";

/**
 * Where a user lands after signing in with no `returnTo` — and where an
 * already-authenticated visitor to an auth page is sent instead.
 */
export const DEFAULT_AUTHENTICATED_PATH = DASHBOARD_PATH;

/**
 * Set by the proxy on every matched request so server-side guards can build a
 * `returnTo` back to the page the user actually asked for. Server Components
 * have no access to the request URL otherwise.
 */
export const PATHNAME_HEADER = "x-pathname";

/** Auth pages, which redirect *away* when a session already exists. */
export const AUTH_PATHS = [
  LOGIN_PATH,
  SIGNUP_PATH,
  FORGOT_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
] as const;

/** Prefixes requiring an authenticated, email-verified user. */
export const PROTECTED_PREFIXES = [DASHBOARD_PATH, ADMIN_PATH] as const;

/** Prefixes additionally requiring `role === "ADMIN"` (FR-4). */
export const ADMIN_PREFIXES = [ADMIN_PATH] as const;

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  // Exact match or a real segment boundary — `/administration` must not be
  // treated as living under `/admin`.
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isProtectedPath(pathname: string): boolean {
  return matchesPrefix(pathname, PROTECTED_PREFIXES);
}

export function isAdminPath(pathname: string): boolean {
  return matchesPrefix(pathname, ADMIN_PREFIXES);
}

export function isAuthPath(pathname: string): boolean {
  return matchesPrefix(pathname, AUTH_PATHS);
}

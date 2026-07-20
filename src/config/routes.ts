// Application route constants and the access rules that go with them.
//
// Defined once so the proxy, the server-side guards, and every link in the UI
// agree on what a path is called and whether it needs a session. Public event
// sites are deliberately absent: they live under the `[site]` catch-all and are
// never gated (see `config/site.ts`).

export const HOME_PATH = "/";

export const LOGIN_PATH = "/login";
export const SIGNUP_PATH = "/signup";
export const VERIFY_EMAIL_PATH = "/verify-email";
export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const RESET_PASSWORD_PATH = "/reset-password";

export const DASHBOARD_PATH = "/dashboard";
export const ADMIN_PATH = "/admin";

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

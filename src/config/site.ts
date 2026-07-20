// App-wide identity and URL constants. Never hardcode these at call sites —
// e.g. metadata, emails, and public-site URL construction all read from here.

export const SITE_NAME = "Tedxplore";
export const SITE_DOMAIN = "tedxplore.com";

export const SITE_DESCRIPTION =
  "A premium event website generated automatically from structured event data.";

// Falls back to localhost for local dev; set in the environment for
// preview/production deploys.
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Public event sites are served at `/tedx{slug}` (BR-2).
export const TEDX_PATH_PREFIX = "/tedx";

export function tedxSitePath(slug: string): string {
  return `${TEDX_PATH_PREFIX}${slug}`;
}

export function tedxSiteUrl(slug: string): string {
  return `${APP_URL}${tedxSitePath(slug)}`;
}

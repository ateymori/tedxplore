// App-wide identity and URL constants. Never hardcode these at call sites —
// e.g. metadata, emails, and public-site URL construction all read from here.

export const SITE_NAME = "tedxplore";
export const SITE_DOMAIN = "tedxplore.com";

export const SITE_DESCRIPTION =
  "A premium event website generated automatically from structured event data.";

/**
 * Where an organizer reaches a human. Named here because the suspension email
 * is the one message with no in-app action attached to it — replying is the
 * only route back, so the address must never be a hardcoded string that drifts.
 */
export const SUPPORT_EMAIL = `support@${SITE_DOMAIN}`;

// Falls back to localhost for local dev; set in the environment for
// preview/production deploys.
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Public event sites live at `tedxplore.com/tedx{slug}` (BR-2) — a path on the
 * main application, not a subdomain and not a separate domain. `/tedxmcgillu`
 * is one route of this Next.js app, served from the same deployment as the
 * dashboard and admin area.
 *
 * The prefix and the slug share a single URL segment, which the App Router
 * cannot express as a folder: a directory named `tedx[slug]` does not match
 * anything (verified — partial dynamic segments are unsupported; a dynamic
 * segment must occupy the whole segment). The public route is therefore a
 * top-level `[site]` segment that receives the *entire* segment — `tedxmcgillu`
 * — and splits the prefix off itself, using `parseTedxSegment` below.
 *
 * Static sibling routes (`/dashboard`, `/admin`, `/api/...`) take precedence
 * over `[site]`, so the catch-all never shadows the application.
 */
export const TEDX_PATH_PREFIX = "/tedx";

/**
 * The cache tag for one public event site.
 *
 * Named here rather than at either end because two very distant pieces of code
 * have to agree on it exactly: Phase 8's `[site]` route attaches it when it
 * caches, and Phase 7's publishing actions revalidate it (`server/revalidate.ts`).
 * A typo in either would not fail — it would just silently serve a suspended
 * site until the next deploy, which is the worst possible failure mode for this
 * particular string.
 */
export function siteCacheTag(slug: string): string {
  return `site:${slug}`;
}

/**
 * The cache tag for the sitemap (task 8.2).
 *
 * Separate from `siteCacheTag` because it is invalidated by a different event:
 * the sitemap changes when a site *joins or leaves* the published set, not
 * when its content changes. Publishing and suspending do both at once, which
 * is why `revalidateSite` updates this alongside the per-site tag.
 */
export const SITEMAP_CACHE_TAG = "sitemap";

/** The bare prefix, without the leading slash — the URL-segment form. */
const TEDX_SEGMENT_PREFIX = "tedx";

/**
 * The URL-segment form of a slug — `tedxmcgillu`, with no leading slash.
 *
 * The exact inverse of `parseTedxSegment`, and the value `generateStaticParams`
 * hands back for the `[site]` param (task 8.1). Named here rather than
 * assembled at the route so the round trip is one module's responsibility.
 */
export function tedxSiteSegment(slug: string): string {
  return `${TEDX_SEGMENT_PREFIX}${slug}`;
}

export function tedxSitePath(slug: string): string {
  return `${TEDX_PATH_PREFIX}${slug}`;
}

export function tedxSiteUrl(slug: string): string {
  return `${APP_URL}${tedxSitePath(slug)}`;
}

/**
 * The inverse of `tedxSitePath`: turns a `[site]` route param back into a slug.
 *
 * Returns `null` when the segment isn't an event URL at all, which the route
 * should treat as a 404. Lives here rather than in the route so the two
 * directions of the mapping can never drift apart.
 *
 * Note this only checks the *shape* of the segment. Whether the slug is valid
 * (`slugSchema`) or exists is the route's business.
 */
export function parseTedxSegment(segment: string): string | null {
  if (!segment.startsWith(TEDX_SEGMENT_PREFIX)) return null;

  const slug = segment.slice(TEDX_SEGMENT_PREFIX.length);
  return slug.length === 0 ? null : slug;
}

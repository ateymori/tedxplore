// Centralized reserved-slug blocklist (BR-4). Checked, lowercased, against
// every candidate slug at creation time in addition to the DB uniqueness
// constraint — never duplicate this list at call sites.

// App routes and platform-reserved words.
//
// Note these can't actually collide with app routes: an event lives at
// `/tedx{slug}`, so slug "admin" yields `/tedxadmin`, never `/admin` — and
// static routes outrank the `[site]` segment regardless. They stay blocked
// because URLs like `/tedxadmin` or `/tedxapi` read as platform surfaces and
// invite impersonation. A slug beginning with `tedx` is the only true
// collision risk, and only against a future top-level route starting the same
// way.
const RESERVED_ROUTE_SLUGS = [
  "admin",
  "api",
  "auth",
  "login",
  "logout",
  "signup",
  "verify-email",
  "reset-password",
  "forgot-password",
  "dashboard",
  "preview",
  "settings",
  "account",
  "app",
  "static",
  "public",
  "assets",
  "favicon",
  "robots",
  "sitemap",
  "health",
  "docs",
  "status",
  // Blocks slug "plore" specifically so /tedxplore can't be claimed as an
  // event site — it reads as the platform's own brand (BR-4).
  "plore",
] as const;

// Brand/legal/support terms called out explicitly in BR-4.
const RESERVED_BRAND_SLUGS = [
  "press",
  "about",
  "terms",
  "privacy",
  "support",
  "www",
  "mail",
  "tedx",
  "tedxplore",
] as const;

// Intentionally empty: do not hardcode a profanity/slur list in source.
// Populate from a vetted, maintained third-party list before launch and
// keep it out of version control if it's ever derived from a licensed
// dataset.
const OFFENSIVE_TERMS: readonly string[] = [];

export const RESERVED_SLUGS: ReadonlySet<string> = new Set(
  [...RESERVED_ROUTE_SLUGS, ...RESERVED_BRAND_SLUGS, ...OFFENSIVE_TERMS].map((s) =>
    s.toLowerCase(),
  ),
);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

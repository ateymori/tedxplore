// Single source of truth for content limits (BR-11) and related validation
// bounds. Imported by Zod schemas, UI copy, and server-side checks alike —
// never hardcode these values at call sites.

export const MAX_SPEAKERS = 16;
export const MAX_TEAM_MEMBERS = 30;
export const MAX_SPONSORS = 30;
export const MAX_FAQS = 30;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB (FR-21)

export const ACCEPTED_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

// SVG is only accepted for sponsor logos, and only if sanitization proves
// feasible (FR-21) — kept separate so callers opt in explicitly per field.
export const ACCEPTED_SPONSOR_LOGO_CONTENT_TYPES = [
  ...ACCEPTED_IMAGE_CONTENT_TYPES,
  "image/svg+xml",
] as const;

export const SLUG_MIN_LENGTH = 2;
export const SLUG_MAX_LENGTH = 50;

export const THEME_MAX_LENGTH = 100; // BR-5d

// Not specified by project-scope.md as a business rule — a plain technical
// safety bound so the field can't grow unbounded, kept equal to Theme's cap
// for consistency.
export const DISPLAY_NAME_MAX_LENGTH = 100;

// The license holder / lead organizer named on the TEDx license (BR-16). Same
// reasoning as above: a safety bound, not a business rule.
export const LICENSE_HOLDER_NAME_MAX_LENGTH = 100;

// Auth bounds. Shared by the client-side form schemas and Better Auth's own
// server-side enforcement, so the two can never disagree about what the user
// was told. `PASSWORD_MAX_LENGTH` is Better Auth's default ceiling, restated
// here so the sign-up form can show it.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const USER_NAME_MAX_LENGTH = 100;

// Token lifetimes, in seconds. Verification is generous because it is often
// actioned on another device; reset is short because the link is a credential.
// The email templates derive the "expires in N hours" copy from these, so the
// promise in the message can't drift from what the server enforces.
export const EMAIL_VERIFICATION_TTL_SECONDS = 24 * 60 * 60;
export const PASSWORD_RESET_TTL_SECONDS = 60 * 60;

export const PREVIEW_TOKEN_BYTES = 32; // 256-bit (BR business rules, tech-stack decision 6)

/**
 * Failed preview-token lookups tolerated per IP per hour (task 9.4).
 *
 * Not a brute-force defence in the cryptographic sense — 256 bits is
 * unsweepable regardless — but a bound on how many database lookups an address
 * spraying guesses can force, and how much log noise it can generate. Counted
 * against *failures only*, so a legitimate viewer refreshing a valid link
 * never approaches it; only someone producing misses does. Generous, because
 * an honest visitor who pastes a stale link a few times must not be locked out.
 */
export const PREVIEW_GUESS_MAX_PER_HOUR = 20;
export const PREVIEW_GUESS_WINDOW_MS = 60 * 60 * 1000;

export const REPORT_RATE_LIMIT_MAX_PER_HOUR = 3; // per IP per site (BR-15)
export const REPORT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * FR-46: a report's explanation (Phase 9).
 *
 * A floor, for the same reason a rejection reason has one: an admin has to act
 * on this text against a site they have never seen, and "bad" is not something
 * anyone can act on. It is lower than a rejection's, though — a reporter is a
 * stranger doing us a favour, not a reviewer doing their job, and a wall of
 * required typing is how you get no reports at all.
 */
export const REPORT_EXPLANATION_MIN_LENGTH = 10;
export const REPORT_EXPLANATION_MAX_LENGTH = 2000;

// --- Admin review (Phase 7) -------------------------------------------------

/**
 * FR-33: a rejection reason must be long enough to act on. This is the entire
 * body of the email the organizer receives, so "no" passing a non-empty check
 * would be a dead end — see `lib/validation/review.ts`.
 */
export const REJECTION_REASON_MIN_LENGTH = 20;
export const REJECTION_REASON_MAX_LENGTH = 2000;

// --- Operational (Phase 10) -------------------------------------------------

/**
 * How long an unreferenced media asset is left alone before the orphan sweep
 * (task 10.4) may reclaim it. The grace window exists for one race: an asset is
 * recorded a moment before the content field that points at it is set, so a
 * sweep running in that gap must not mistake a brand-new upload for garbage.
 * Snapshot-referenced assets are protected regardless of age.
 */
export const ORPHANED_MEDIA_GRACE_HOURS = 24;

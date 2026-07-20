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

export const REPORT_RATE_LIMIT_MAX_PER_HOUR = 3; // per IP per site (BR-15)
export const REPORT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

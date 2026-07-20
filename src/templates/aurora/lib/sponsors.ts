import type { SponsorContent, SponsorTier } from "@/content/event-content";

/**
 * Sponsor grouping and tier presentation.
 *
 * `EventContent` keeps sponsors as one flat, ordered list precisely so that
 * grouping stays a presentation decision (see `sponsorContentSchema`) — a
 * future template could show a single undifferentiated wall, or order the
 * tiers the other way. This module is Aurora's answer.
 */

/** Highest commitment first — the order tiers are displayed in. */
export const TIER_ORDER: readonly SponsorTier[] = [
  "PARTNER",
  "PLATINUM",
  "GOLD",
  "SILVER",
  "BRONZE",
  "COMMUNITY",
];

export const TIER_LABELS: Record<SponsorTier, string> = {
  PARTNER: "Partners",
  PLATINUM: "Platinum",
  GOLD: "Gold",
  SILVER: "Silver",
  BRONZE: "Bronze",
  COMMUNITY: "Community",
};

/**
 * How prominent each tier's logos are.
 *
 * The visual hierarchy *is* the sponsorship product: a partner paying for top
 * billing has to look different from a community supporter, and doing it with
 * one size token per tier keeps that promise consistent instead of leaving it
 * to whatever the grid happens to do.
 */
export const TIER_LOGO_HEIGHT: Record<SponsorTier, string> = {
  PARTNER: "h-16 sm:h-20",
  PLATINUM: "h-14 sm:h-16",
  GOLD: "h-12 sm:h-14",
  SILVER: "h-10 sm:h-12",
  BRONZE: "h-9 sm:h-10",
  COMMUNITY: "h-8 sm:h-9",
};

export interface SponsorTierGroup {
  tier: SponsorTier;
  label: string;
  sponsors: SponsorContent[];
}

/**
 * Groups sponsors into tiers, dropping empty ones.
 *
 * The dropping *is* FR-38's per-tier auto-hide: a heading with nothing under it
 * reads as a tier the organizer failed to sell, which is worse than not
 * mentioning it. Sponsors keep their relative order within a tier, which is the
 * `sortOrder` the organizer arranged in the editor.
 *
 * An unrecognized tier string cannot appear here — `sponsorTierSchema` has
 * already validated it — so anything not in `TIER_ORDER` genuinely does not
 * exist and needs no fallback bucket.
 */
export function groupSponsorsByTier(sponsors: SponsorContent[]): SponsorTierGroup[] {
  return TIER_ORDER.map((tier) => ({
    tier,
    label: TIER_LABELS[tier],
    sponsors: sponsors.filter((sponsor) => sponsor.tier === tier),
  })).filter((group) => group.sponsors.length > 0);
}

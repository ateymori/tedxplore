import { describe, expect, it } from "vitest";

import type { SponsorContent, SponsorTier } from "@/content/event-content";

import { TIER_ORDER, groupSponsorsByTier } from "./sponsors";

function sponsor(id: string, tier: SponsorTier, name = id): SponsorContent {
  return { id, name, tier, logo: null, websiteUrl: null };
}

describe("groupSponsorsByTier", () => {
  it("orders tiers by commitment, not by the order sponsors were added", () => {
    const groups = groupSponsorsByTier([
      sponsor("a", "COMMUNITY"),
      sponsor("b", "PARTNER"),
      sponsor("c", "GOLD"),
    ]);

    expect(groups.map((group) => group.tier)).toEqual(["PARTNER", "GOLD", "COMMUNITY"]);
  });

  // FR-38's per-tier auto-hide. A heading with nothing under it advertises a
  // tier the organizer did not sell.
  it("drops tiers with no sponsors", () => {
    const groups = groupSponsorsByTier([sponsor("a", "COMMUNITY")]);

    expect(groups).toHaveLength(1);
    expect(groups[0].tier).toBe("COMMUNITY");
  });

  it("returns nothing at all for an empty list", () => {
    expect(groupSponsorsByTier([])).toEqual([]);
  });

  it("preserves the organizer's ordering within a tier", () => {
    const groups = groupSponsorsByTier([
      sponsor("first", "GOLD"),
      sponsor("other", "SILVER"),
      sponsor("second", "GOLD"),
    ]);

    expect(groups[0].sponsors.map((entry) => entry.id)).toEqual(["first", "second"]);
  });

  it("covers every tier the schema allows", () => {
    const groups = groupSponsorsByTier(TIER_ORDER.map((tier) => sponsor(tier, tier)));

    expect(groups.map((group) => group.tier)).toEqual([...TIER_ORDER]);
    expect(groups.every((group) => group.label.length > 0)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { THEME_MAX_LENGTH } from "@/config/limits";

import {
  aboutContentSchema,
  contactContentSchema,
  faqContentSchema,
  heroContentSchema,
  registrationContentSchema,
  scheduleContentSchema,
  socialLinksSchema,
  speakerContentSchema,
  sponsorContentSchema,
  venueContentSchema,
} from "./content";

/**
 * The theme running through these tests is FR-15a: blank must be *accepted*
 * everywhere except the display name, and must arrive downstream as `null`
 * rather than `""` — the editor's most load-bearing behaviour, and the easiest
 * to regress by adding a well-meaning `.min(1)`.
 */

describe("heroContentSchema", () => {
  it("requires a display name", () => {
    const result = heroContentSchema.safeParse({ displayName: "   ", theme: "" });
    expect(result.success).toBe(false);
  });

  it("accepts a blank theme and yields null", () => {
    const result = heroContentSchema.safeParse({ displayName: "TEDxMcGill", theme: "" });
    expect(result.success).toBe(true);
    expect(result.data?.theme).toBeNull();
  });

  it("treats a whitespace-only theme as blank", () => {
    const result = heroContentSchema.safeParse({ displayName: "TEDxMcGill", theme: "   \n " });
    expect(result.data?.theme).toBeNull();
  });

  it("trims a theme before applying BR-5d's cap", () => {
    const padded = `  ${"a".repeat(THEME_MAX_LENGTH)}  `;
    const result = heroContentSchema.safeParse({ displayName: "TEDxMcGill", theme: padded });
    expect(result.success).toBe(true);
    expect(result.data?.theme).toHaveLength(THEME_MAX_LENGTH);
  });

  it("rejects a theme over the cap", () => {
    const result = heroContentSchema.safeParse({
      displayName: "TEDxMcGill",
      theme: "a".repeat(THEME_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it("accepts a missing theme key entirely", () => {
    const result = heroContentSchema.safeParse({ displayName: "TEDxMcGill" });
    expect(result.success).toBe(true);
    expect(result.data?.theme).toBeNull();
  });
});

describe("aboutContentSchema", () => {
  it("accepts blank", () => {
    expect(aboutContentSchema.parse({ aboutText: "" }).aboutText).toBeNull();
  });

  it("preserves internal formatting while trimming the ends", () => {
    const parsed = aboutContentSchema.parse({ aboutText: "  one\n\ntwo  " });
    expect(parsed.aboutText).toBe("one\n\ntwo");
  });
});

describe("scheduleContentSchema", () => {
  it("accepts both fields blank", () => {
    const result = scheduleContentSchema.safeParse({ eventDate: "", timezone: "" });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ eventDate: null, timezone: null });
  });

  it("resolves wall time in the given zone to an absolute instant", () => {
    const result = scheduleContentSchema.safeParse({
      eventDate: "2026-11-14T18:00",
      timezone: "America/Toronto",
    });
    expect(result.success).toBe(true);
    expect(result.data?.eventDate?.toISOString()).toBe("2026-11-14T23:00:00.000Z");
    expect(result.data?.timezone).toBe("America/Toronto");
  });

  it("keeps a timezone chosen before the date", () => {
    const result = scheduleContentSchema.safeParse({ eventDate: "", timezone: "Europe/Paris" });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ eventDate: null, timezone: "Europe/Paris" });
  });

  it("refuses a date with no timezone rather than assuming UTC", () => {
    const result = scheduleContentSchema.safeParse({ eventDate: "2026-11-14T18:00", timezone: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["timezone"]);
  });

  it("rejects an unknown timezone", () => {
    const result = scheduleContentSchema.safeParse({
      eventDate: "2026-11-14T18:00",
      timezone: "Mars/Olympus_Mons",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["timezone"]);
  });

  it("rejects a date that does not exist", () => {
    const result = scheduleContentSchema.safeParse({
      eventDate: "2026-02-30T18:00",
      timezone: "UTC",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["eventDate"]);
  });
});

describe("contactContentSchema", () => {
  it("accepts blank email and no links", () => {
    const result = contactContentSchema.safeParse({ contactEmail: "", socialLinks: [] });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ contactEmail: null, socialLinks: [] });
  });

  it("rejects a malformed email", () => {
    const result = contactContentSchema.safeParse({ contactEmail: "hello@", socialLinks: [] });
    expect(result.success).toBe(false);
  });

  it("accepts a valid email", () => {
    const result = contactContentSchema.safeParse({
      contactEmail: "hello@tedxmcgill.com",
      socialLinks: [],
    });
    expect(result.data?.contactEmail).toBe("hello@tedxmcgill.com");
  });
});

describe("socialLinksSchema", () => {
  it("drops rows the user added but never filled in", () => {
    const result = socialLinksSchema.safeParse([
      { platform: "INSTAGRAM", url: "https://instagram.com/tedxmcgill" },
      { platform: "WEBSITE", url: "   " },
    ]);
    expect(result.success).toBe(true);
    expect(result.data).toEqual([
      { platform: "INSTAGRAM", url: "https://instagram.com/tedxmcgill" },
    ]);
  });

  it("rejects a row the user did fill in badly", () => {
    const result = socialLinksSchema.safeParse([{ platform: "WEBSITE", url: "not a url" }]);
    expect(result.success).toBe(false);
  });

  it("enforces BR-12 — no javascript: URLs", () => {
    const result = socialLinksSchema.safeParse([{ platform: "OTHER", url: "javascript:alert(1)" }]);
    expect(result.success).toBe(false);
  });

  it("treats a missing array as empty", () => {
    expect(socialLinksSchema.parse(undefined)).toEqual([]);
    expect(socialLinksSchema.parse(null)).toEqual([]);
  });
});

describe("registrationContentSchema", () => {
  it("accepts blank", () => {
    expect(registrationContentSchema.parse({ registrationUrl: "" }).registrationUrl).toBeNull();
  });

  it("rejects a non-http scheme (BR-12)", () => {
    expect(
      registrationContentSchema.safeParse({ registrationUrl: "javascript:alert(1)" }).success,
    ).toBe(false);
  });
});

describe("venueContentSchema", () => {
  it("accepts an entirely empty venue", () => {
    const result = venueContentSchema.safeParse({
      venueName: "",
      venueAddress: "",
      venueDescription: "",
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      venueName: null,
      venueAddress: null,
      venueDescription: null,
    });
  });
});

describe("speakerContentSchema", () => {
  it("requires a name on a row that exists", () => {
    expect(speakerContentSchema.safeParse({ name: "  ", links: [] }).success).toBe(false);
  });

  it("accepts a name and nothing else", () => {
    const result = speakerContentSchema.safeParse({ name: "Ada Lovelace" });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      name: "Ada Lovelace",
      title: null,
      talkTitle: null,
      bio: null,
      links: [],
    });
  });
});

describe("sponsorContentSchema", () => {
  it("requires a tier from the fixed set", () => {
    expect(sponsorContentSchema.safeParse({ name: "Acme", tier: "DIAMOND" }).success).toBe(false);
  });

  it("accepts a sponsor with no website", () => {
    const result = sponsorContentSchema.safeParse({ name: "Acme", tier: "GOLD", websiteUrl: "" });
    expect(result.success).toBe(true);
    expect(result.data?.websiteUrl).toBeNull();
  });
});

describe("faqContentSchema", () => {
  it("requires both halves, matching the serializer's drop rule", () => {
    expect(faqContentSchema.safeParse({ question: "Where?", answer: "" }).success).toBe(false);
    expect(faqContentSchema.safeParse({ question: "", answer: "Downtown." }).success).toBe(false);
    expect(faqContentSchema.safeParse({ question: "Where?", answer: "Downtown." }).success).toBe(
      true,
    );
  });
});

import { describe, expect, it } from "vitest";

import { eventContentSchema } from "@/content/event-content";
import { sectionVisibility } from "@/content/serializer";
import { isValidDisplayName } from "@/lib/validation/display-name";
import { DEFAULT_TEMPLATE_ID, findTemplate, listTemplates } from "@/templates/registry";
import { demoContent } from "@/templates/contract";

const NOW = new Date("2026-01-15T12:00:00.000Z");

describe("template registry", () => {
  it("resolves the default template id", () => {
    expect(findTemplate(DEFAULT_TEMPLATE_ID)).not.toBeNull();
  });

  it("returns null for an unknown id rather than throwing", () => {
    expect(findTemplate("nope")).toBeNull();
  });
});

describe.each(listTemplates().map((template) => [template.id, template] as const))(
  "template %s demo content",
  (_id, template) => {
    it("is a valid EventContent document", () => {
      expect(() => eventContentSchema.parse(demoContent(template, NOW))).not.toThrow();
    });

    it("has a display name that passes the display-name rules (BR-5b)", () => {
      expect(isValidDisplayName(template.demoDisplayName)).toBe(true);
    });

    it("fills every optional section, so a seeded draft shows a complete site (FR-10)", () => {
      const visibility = sectionVisibility(demoContent(template, NOW));

      // Every section that can auto-hide (BR-13) must be populated — a demo
      // with an empty section teaches the organizer that the section does not
      // exist, which is exactly the wrong first impression.
      expect(visibility).toEqual({
        about: true,
        venue: true,
        speakers: true,
        team: true,
        sponsors: true,
        faqs: true,
        contact: true,
        countdown: true,
        registration: true,
      });
    });

    it("dates the event in the future relative to the caller's clock (FR-39)", () => {
      const content = demoContent(template, NOW);

      expect(content.schedule.startsAt).not.toBeNull();
      expect(new Date(content.schedule.startsAt as string).getTime()).toBeGreaterThan(
        NOW.getTime(),
      );
    });

    it("moves the event date with the clock, so the demo never goes stale", () => {
      const later = new Date(NOW.getTime() + 365 * 24 * 60 * 60 * 1000);

      expect(demoContent(template, later).schedule.startsAt).not.toEqual(
        demoContent(template, NOW).schedule.startsAt,
      );
    });

    it("references no images, exercising the FR-38 hero fallback", () => {
      const content = demoContent(template, NOW);

      expect(content.heroImage).toBeNull();
      expect(content.speakers.every((speaker) => speaker.photo === null)).toBe(true);
    });

    it("stays within the content limits (BR-11)", () => {
      // `eventContentSchema` enforces the maxima; this asserts the seed is a
      // realistic size rather than a single token item per list.
      const content = demoContent(template, NOW);

      expect(content.speakers.length).toBeGreaterThanOrEqual(3);
      expect(content.sponsors.length).toBeGreaterThanOrEqual(3);
      expect(content.faqs.length).toBeGreaterThanOrEqual(3);
    });

    it("spans several sponsor tiers, so tier grouping is visible in the demo", () => {
      const tiers = new Set(demoContent(template, NOW).sponsors.map((sponsor) => sponsor.tier));

      expect(tiers.size).toBeGreaterThanOrEqual(3);
    });
  },
);

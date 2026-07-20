import { describe, expect, it } from "vitest";

import { checkCompleteness, type CompletenessField } from "./completeness";
import { emptyEventContent, type EventContent } from "./event-content";

/** Satisfies every BR-14 requirement and nothing more. */
function completeContent(overrides: Partial<EventContent> = {}): EventContent {
  return {
    ...emptyEventContent("TEDxMcGill University"),
    theme: "Ideas worth spreading",
    schedule: { startsAt: "2026-11-14T18:00:00.000Z", timezone: "America/Toronto" },
    venue: { name: "Pollack Hall", address: null, description: null, image: null },
    contact: { email: "hello@example.com", socialLinks: [] },
    ...overrides,
  };
}

function missingFields(content: EventContent): CompletenessField[] {
  const result = checkCompleteness(content);
  return result.ok ? [] : result.issues.map((issue) => issue.field);
}

describe("checkCompleteness", () => {
  it("passes a draft meeting the BR-14 minimum", () => {
    expect(checkCompleteness(completeContent())).toEqual({ ok: true });
  });

  it("blocks a minimal draft and names every missing requirement", () => {
    // The case that matters most: a draft that is perfectly valid to *save*
    // (FR-15a) but nowhere near ready to publish. The two rules are separate
    // by design.
    const minimal = emptyEventContent("TEDxMcGill University");

    expect(missingFields(minimal)).toEqual([
      "themeOrAbout",
      "eventDate",
      "venueName",
      "contactEmail",
    ]);
  });

  it("reports all problems at once, not just the first (FR-30)", () => {
    const result = checkCompleteness(emptyEventContent("TEDxMcGill University"));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.issues.length).toBe(4);
  });

  it("accepts a theme alone", () => {
    expect(missingFields(completeContent({ theme: "Ideas", about: null }))).toEqual([]);
  });

  it("accepts an about description alone", () => {
    expect(missingFields(completeContent({ theme: null, about: "A day of talks." }))).toEqual(
      [],
    );
  });

  it("rejects when both theme and about are missing", () => {
    expect(missingFields(completeContent({ theme: null, about: null }))).toEqual([
      "themeOrAbout",
    ]);
  });

  it.each([
    ["event date", { schedule: { startsAt: null, timezone: null } }],
    ["venue name", { venue: { name: null, address: null, description: null, image: null } }],
    ["contact email", { contact: { email: null, socialLinks: [] } }],
  ])("requires the %s", (_label, override) => {
    expect(missingFields(completeContent(override as Partial<EventContent>))).toHaveLength(1);
  });

  it("does not require any optional section (FR-30)", () => {
    const content = completeContent();
    expect(content.speakers).toEqual([]);
    expect(content.sponsors).toEqual([]);
    expect(missingFields(content)).toEqual([]);
  });

  it("gives every issue an actionable message and an editor section", () => {
    const result = checkCompleteness(emptyEventContent("TEDxMcGill University"));
    expect(result.ok).toBe(false);

    if (!result.ok) {
      for (const issue of result.issues) {
        expect(issue.message.length).toBeGreaterThan(0);
        expect(issue.section).toBeTruthy();
      }
    }
  });
});

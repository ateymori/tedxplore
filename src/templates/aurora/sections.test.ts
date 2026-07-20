import { describe, expect, it } from "vitest";

import { emptyEventContent, type EventContent } from "@/content/event-content";

import { AURORA_SECTION_IDS, auroraNavItems } from "./sections";

function withContent(overrides: Partial<EventContent>): EventContent {
  return { ...emptyEventContent("TEDxAurora Bay"), ...overrides };
}

const speaker = {
  id: "s1",
  name: "Amara Okonjo",
  title: null,
  bio: null,
  talkTitle: null,
  photo: null,
  links: [],
};

describe("auroraNavItems", () => {
  // The exit criterion for Phase 4: a draft with nothing but a display name
  // still renders a complete-looking site. Here that means a nav with no
  // entries rather than seven links to empty sections.
  it("is empty for a minimal draft", () => {
    expect(auroraNavItems(emptyEventContent("TEDxAurora Bay"))).toEqual([]);
  });

  it("lists only the sections that have usable content", () => {
    const items = auroraNavItems(withContent({ about: "A day of ideas.", speakers: [speaker] }));

    expect(items).toEqual([
      { id: AURORA_SECTION_IDS.about, label: "About" },
      { id: AURORA_SECTION_IDS.speakers, label: "Speakers" },
    ]);
  });

  it("keeps a fixed order regardless of which sections are present", () => {
    const items = auroraNavItems(
      withContent({
        faqs: [{ id: "f1", question: "How long?", answer: "All day." }],
        speakers: [speaker],
        venue: { name: "The Mariner Theatre", address: null, description: null, image: null },
      }),
    );

    expect(items.map((item) => item.label)).toEqual(["Speakers", "Venue", "FAQ"]);
  });

  // The Hero, About TED, About TEDx, the disclaimer, and the footer always
  // render (FR-38) but are not destinations — a nav entry for them would
  // compete with the sections a visitor is actually looking for.
  it("never lists the always-rendered sections", () => {
    const items = auroraNavItems(
      withContent({
        theme: "Ideas worth spreading",
        schedule: { startsAt: "2026-11-15T15:30:00.000Z", timezone: "America/Toronto" },
        registrationUrl: "https://example.com/tickets",
      }),
    );

    expect(items).toEqual([]);
  });
});

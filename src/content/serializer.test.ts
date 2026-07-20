import { describe, expect, it } from "vitest";

import { eventContentSchema } from "./event-content";
import {
  draftToEventContent,
  sectionVisibility,
  type EventDraft,
} from "./serializer";

/** A draft with only the one field that can never be blank (FR-15a). */
function minimalDraft(overrides: Partial<EventDraft> = {}): EventDraft {
  return {
    displayName: "TEDxMcGill University",
    theme: null,
    aboutText: null,
    eventDate: null,
    timezone: null,
    venueName: null,
    venueAddress: null,
    venueDescription: null,
    contactEmail: null,
    registrationUrl: null,
    socialLinks: null,
    heroImage: null,
    venueImage: null,
    speakers: [],
    teamMembers: [],
    sponsors: [],
    faqs: [],
    ...overrides,
  };
}

function fullDraft(): EventDraft {
  return minimalDraft({
    theme: "Ideas worth spreading",
    aboutText: "A full day of talks.",
    eventDate: new Date("2026-11-14T18:00:00.000Z"),
    timezone: "America/Toronto",
    venueName: "Pollack Hall",
    venueAddress: "555 Sherbrooke St W",
    venueDescription: "A concert hall.",
    contactEmail: "hello@example.com",
    registrationUrl: "https://example.com/tickets",
    socialLinks: [{ platform: "INSTAGRAM", url: "https://instagram.com/tedx" }],
    heroImage: { cloudinaryPublicId: "hero/a", width: 2400, height: 1350 },
    venueImage: { cloudinaryPublicId: "venue/a", width: 1600, height: 900 },
    speakers: [
      {
        id: "s1",
        name: "Ada Lovelace",
        title: "Mathematician",
        bio: "Bio.",
        talkTitle: "On engines",
        photo: { cloudinaryPublicId: "sp/1", width: 800, height: 800 },
        links: [{ platform: "X", url: "https://x.com/ada" }],
        sortOrder: 0,
      },
    ],
    teamMembers: [
      { id: "t1", name: "Sam Lee", role: "Curator", photo: null, links: null, sortOrder: 0 },
    ],
    sponsors: [
      {
        id: "sp1",
        name: "Acme",
        tier: "GOLD",
        logo: null,
        websiteUrl: "https://acme.example.com",
        sortOrder: 0,
      },
    ],
    faqs: [{ id: "f1", question: "Parking?", answer: "Yes.", sortOrder: 0 }],
  });
}

describe("draftToEventContent — minimal draft", () => {
  const content = draftToEventContent(minimalDraft());

  it("produces a schema-valid document", () => {
    expect(eventContentSchema.safeParse(content).success).toBe(true);
  });

  it("carries the display name and nulls everything else", () => {
    expect(content.displayName).toBe("TEDxMcGill University");
    expect(content.theme).toBeNull();
    expect(content.about).toBeNull();
    expect(content.heroImage).toBeNull();
    expect(content.schedule).toEqual({ startsAt: null, timezone: null });
    expect(content.venue).toEqual({
      name: null,
      address: null,
      description: null,
      image: null,
    });
    expect(content.registrationUrl).toBeNull();
  });

  it("represents empty lists as [] rather than null", () => {
    expect(content.speakers).toEqual([]);
    expect(content.team).toEqual([]);
    expect(content.sponsors).toEqual([]);
    expect(content.faqs).toEqual([]);
    expect(content.contact.socialLinks).toEqual([]);
  });

  it("hides every optional section (BR-13)", () => {
    expect(sectionVisibility(content)).toEqual({
      about: false,
      venue: false,
      speakers: false,
      team: false,
      sponsors: false,
      faqs: false,
      contact: false,
      countdown: false,
      registration: false,
    });
  });
});

describe("draftToEventContent — fully populated draft", () => {
  const content = draftToEventContent(fullDraft());

  it("produces a schema-valid document", () => {
    expect(eventContentSchema.safeParse(content).success).toBe(true);
  });

  it("maps every section across", () => {
    expect(content.theme).toBe("Ideas worth spreading");
    expect(content.schedule.startsAt).toBe("2026-11-14T18:00:00.000Z");
    expect(content.schedule.timezone).toBe("America/Toronto");
    expect(content.venue.name).toBe("Pollack Hall");
    expect(content.venue.image?.cloudinaryPublicId).toBe("venue/a");
    expect(content.contact.email).toBe("hello@example.com");
    expect(content.contact.socialLinks).toHaveLength(1);
    expect(content.speakers[0]?.links).toHaveLength(1);
    expect(content.sponsors[0]?.tier).toBe("GOLD");
    expect(content.faqs[0]?.question).toBe("Parking?");
  });

  it("shows every optional section (BR-13)", () => {
    expect(Object.values(sectionVisibility(content)).every(Boolean)).toBe(true);
  });
});

describe("draftToEventContent — normalization", () => {
  it("collapses whitespace-only fields to null", () => {
    const content = draftToEventContent(
      minimalDraft({ theme: "   ", aboutText: "\n\t ", venueName: "" }),
    );

    expect(content.theme).toBeNull();
    expect(content.about).toBeNull();
    expect(content.venue.name).toBeNull();
  });

  it("trims surrounding whitespace from retained values", () => {
    const content = draftToEventContent(minimalDraft({ theme: "  Ideas  " }));
    expect(content.theme).toBe("Ideas");
  });

  it("orders list items by sortOrder, not insertion order", () => {
    const content = draftToEventContent(
      minimalDraft({
        speakers: [
          { id: "b", name: "Second", title: null, bio: null, talkTitle: null, photo: null, links: null, sortOrder: 2 },
          { id: "a", name: "First", title: null, bio: null, talkTitle: null, photo: null, links: null, sortOrder: 1 },
        ],
      }),
    );

    expect(content.speakers.map((s) => s.name)).toEqual(["First", "Second"]);
  });

  it("drops unnamed list rows — half-filled placeholders (BR-13)", () => {
    const content = draftToEventContent(
      minimalDraft({
        speakers: [
          { id: "a", name: "Ada", title: null, bio: null, talkTitle: null, photo: null, links: null, sortOrder: 0 },
          { id: "b", name: "  ", title: null, bio: null, talkTitle: null, photo: null, links: null, sortOrder: 1 },
        ],
      }),
    );

    expect(content.speakers.map((s) => s.id)).toEqual(["a"]);
  });

  it("drops FAQs missing either half", () => {
    const content = draftToEventContent(
      minimalDraft({
        faqs: [
          { id: "a", question: "Parking?", answer: "Yes.", sortOrder: 0 },
          { id: "b", question: "Food?", answer: "  ", sortOrder: 1 },
          { id: "c", question: "", answer: "Sure.", sortOrder: 2 },
        ],
      }),
    );

    expect(content.faqs.map((f) => f.id)).toEqual(["a"]);
  });

  it.each([
    ["javascript:alert(1)"],
    ["data:text/html,x"],
    ["example.com"],
    ["  "],
  ])("drops the unsafe or malformed registration URL %s (BR-12)", (url) => {
    expect(draftToEventContent(minimalDraft({ registrationUrl: url })).registrationUrl).toBeNull();
  });

  it("drops individually invalid social links without failing the document", () => {
    const content = draftToEventContent(
      minimalDraft({
        socialLinks: [
          { platform: "INSTAGRAM", url: "https://instagram.com/tedx" },
          { platform: "INSTAGRAM", url: "javascript:alert(1)" },
          { platform: "NOT_A_PLATFORM", url: "https://example.com" },
          "garbage",
        ],
      }),
    );

    expect(content.contact.socialLinks).toEqual([
      { platform: "INSTAGRAM", url: "https://instagram.com/tedx" },
    ]);
  });

  it("tolerates a non-array social links column", () => {
    expect(
      draftToEventContent(minimalDraft({ socialLinks: { nope: true } })).contact.socialLinks,
    ).toEqual([]);
  });
});

describe("sectionVisibility", () => {
  it("shows the venue when only an address is set", () => {
    const content = draftToEventContent(minimalDraft({ venueAddress: "555 Sherbrooke St W" }));
    expect(sectionVisibility(content).venue).toBe(true);
  });

  it("shows contact when only social links are set", () => {
    const content = draftToEventContent(
      minimalDraft({ socialLinks: [{ platform: "X", url: "https://x.com/tedx" }] }),
    );
    expect(sectionVisibility(content).contact).toBe(true);
  });
});

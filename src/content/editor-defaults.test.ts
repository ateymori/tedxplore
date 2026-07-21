import { describe, expect, it } from "vitest";

import { scheduleContentSchema } from "@/lib/validation/content";

import { draftToEditorDefaults } from "./editor-defaults";
import type { EventDraft } from "./serializer";

function draft(overrides: Partial<EventDraft> = {}): EventDraft {
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

describe("draftToEditorDefaults", () => {
  it("turns every absent value into an empty string, never null", () => {
    const defaults = draftToEditorDefaults(draft());

    // Controlled inputs handed `null` silently become uncontrolled, after
    // which typing stops updating form state — a bug that looks like the
    // editor ignoring the user.
    expect(defaults.hero.theme).toBe("");
    expect(defaults.about.aboutText).toBe("");
    expect(defaults.schedule.eventDate).toBe("");
    expect(defaults.schedule.timezone).toBe("");
    expect(defaults.contact.contactEmail).toBe("");
    expect(defaults.registration.registrationUrl).toBe("");
    expect(defaults.venue.venueName).toBe("");
    expect(defaults.venue.venueAddress).toBe("");
    expect(defaults.venue.venueDescription).toBe("");
  });

  it("keeps the display name, the one field that is never blank", () => {
    expect(draftToEditorDefaults(draft()).hero.displayName).toBe("TEDxMcGill University");
  });

  it("renders the event date in the organizer's own timezone", () => {
    const defaults = draftToEditorDefaults(
      draft({
        eventDate: new Date("2026-11-14T23:00:00.000Z"),
        timezone: "America/Toronto",
      }),
    );

    expect(defaults.schedule.eventDate).toBe("2026-11-14T18:00");
    expect(defaults.schedule.timezone).toBe("America/Toronto");
  });

  it("round-trips the schedule through the save schema unchanged", () => {
    // The property the editor depends on: opening the page and saving without
    // touching the date must not shift the event's start time.
    const original = new Date("2026-07-04T13:15:00.000Z");
    const defaults = draftToEditorDefaults(
      draft({ eventDate: original, timezone: "America/Toronto" }),
    );

    const reparsed = scheduleContentSchema.parse(defaults.schedule);
    expect(reparsed.eventDate?.toISOString()).toBe(original.toISOString());
  });

  it("leaves the date blank when there is no timezone to render it in", () => {
    const defaults = draftToEditorDefaults(
      draft({ eventDate: new Date("2026-11-14T23:00:00.000Z"), timezone: null }),
    );

    expect(defaults.schedule.eventDate).toBe("");
  });

  it("keeps rows the serializer would drop, so they stay fixable", () => {
    // A speaker with no name never reaches the public site (BR-13), but the
    // organizer has to be able to see it in order to finish or delete it.
    const defaults = draftToEditorDefaults(
      draft({
        speakers: [
          {
            id: "s1",
            name: "   ",
            title: null,
            bio: null,
            talkTitle: null,
            photo: null,
            links: null,
            sortOrder: 0,
          },
        ],
        faqs: [{ id: "f1", question: "Where?", answer: "   ", sortOrder: 0 }],
      }),
    );

    expect(defaults.speakers).toHaveLength(1);
    expect(defaults.faqs).toHaveLength(1);
  });

  it("orders every list by sortOrder, not insertion order", () => {
    const defaults = draftToEditorDefaults(
      draft({
        speakers: [
          {
            id: "second",
            name: "B",
            title: null,
            bio: null,
            talkTitle: null,
            photo: null,
            links: null,
            sortOrder: 5,
          },
          {
            id: "first",
            name: "A",
            title: null,
            bio: null,
            talkTitle: null,
            photo: null,
            links: null,
            sortOrder: 1,
          },
        ],
      }),
    );

    expect(defaults.speakers.map((row) => row.id)).toEqual(["first", "second"]);
  });

  it("drops malformed social links rather than making the event uneditable", () => {
    const defaults = draftToEditorDefaults(
      draft({
        socialLinks: [
          { platform: "INSTAGRAM", url: "https://instagram.com/tedxmcgill" },
          { platform: "NOT_A_PLATFORM", url: "https://example.com" },
          { platform: "WEBSITE", url: "javascript:alert(1)" },
          "not an object",
        ],
      }),
    );

    expect(defaults.contact.socialLinks).toEqual([
      { platform: "INSTAGRAM", url: "https://instagram.com/tedxmcgill" },
    ]);
  });

  it("treats a non-array links column as no links", () => {
    const defaults = draftToEditorDefaults(draft({ socialLinks: { nope: true } }));
    expect(defaults.contact.socialLinks).toEqual([]);
  });
});

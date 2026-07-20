import { describe, expect, it } from "vitest";

import { MAX_SPEAKERS, THEME_MAX_LENGTH } from "@/config/limits";

import {
  CURRENT_SCHEMA_VERSION,
  emptyEventContent,
  eventContentSchema,
  type EventContent,
} from "./event-content";

const minimal = emptyEventContent("TEDxMcGill University");

describe("eventContentSchema", () => {
  it("accepts a document with only a display name (FR-15a)", () => {
    const result = eventContentSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it("rejects a blank display name — the one always-required field", () => {
    expect(
      eventContentSchema.safeParse({ ...minimal, displayName: "" }).success,
    ).toBe(false);
    expect(
      eventContentSchema.safeParse({ ...minimal, displayName: "   " }).success,
    ).toBe(false);
  });

  it("pins the schema version so old snapshots can be detected", () => {
    expect(minimal.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(
      eventContentSchema.safeParse({ ...minimal, schemaVersion: 2 }).success,
    ).toBe(false);
  });

  it("survives a JSON round trip unchanged (snapshots are stored as JSON)", () => {
    const roundTripped: unknown = JSON.parse(JSON.stringify(minimal));

    expect(roundTripped).toEqual(minimal);
    expect(eventContentSchema.safeParse(roundTripped).success).toBe(true);
  });

  it("keeps absent values as null rather than dropping the keys", () => {
    const roundTripped = JSON.parse(JSON.stringify(minimal)) as EventContent;

    // The distinction that matters: `undefined` would vanish here, changing
    // the document's shape between the preview and published paths.
    expect(Object.hasOwn(roundTripped, "theme")).toBe(true);
    expect(roundTripped.theme).toBeNull();
    expect(roundTripped.venue.name).toBeNull();
  });

  it("enforces the Theme cap from central config (BR-5d)", () => {
    const atLimit = { ...minimal, theme: "a".repeat(THEME_MAX_LENGTH) };
    const overLimit = { ...minimal, theme: "a".repeat(THEME_MAX_LENGTH + 1) };

    expect(eventContentSchema.safeParse(atLimit).success).toBe(true);
    expect(eventContentSchema.safeParse(overLimit).success).toBe(false);
  });

  it("enforces list limits from central config (BR-11)", () => {
    const speaker = {
      id: "s1",
      name: "Ada Lovelace",
      title: null,
      bio: null,
      talkTitle: null,
      photo: null,
      links: [],
    };

    const atLimit = { ...minimal, speakers: Array(MAX_SPEAKERS).fill(speaker) };
    const overLimit = {
      ...minimal,
      speakers: Array(MAX_SPEAKERS + 1).fill(speaker),
    };

    expect(eventContentSchema.safeParse(atLimit).success).toBe(true);
    expect(eventContentSchema.safeParse(overLimit).success).toBe(false);
  });

  it.each([
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html;base64,PHNjcmlwdD4="],
    ["a bare word", "example.com"],
  ])("rejects %s as a registration URL (BR-12)", (_label, url) => {
    expect(eventContentSchema.safeParse({ ...minimal, registrationUrl: url }).success).toBe(
      false,
    );
  });

  it("accepts http and https registration URLs", () => {
    for (const url of ["https://example.com/tickets", "http://example.com"]) {
      expect(
        eventContentSchema.safeParse({ ...minimal, registrationUrl: url }).success,
      ).toBe(true);
    }
  });

  it("requires an ISO datetime for the event start", () => {
    expect(
      eventContentSchema.safeParse({
        ...minimal,
        schedule: { startsAt: "2026-11-14T18:00:00Z", timezone: "America/Toronto" },
      }).success,
    ).toBe(true);

    expect(
      eventContentSchema.safeParse({
        ...minimal,
        schedule: { startsAt: "November 14, 2026", timezone: null },
      }).success,
    ).toBe(false);
  });

  it("accepts a fully populated document", () => {
    const full: EventContent = {
      ...minimal,
      theme: "Ideas worth spreading, north of the border",
      about: "A day of talks.",
      heroImage: { cloudinaryPublicId: "hero/abc", width: 2400, height: 1350 },
      schedule: { startsAt: "2026-11-14T18:00:00Z", timezone: "America/Toronto" },
      venue: {
        name: "Pollack Hall",
        address: "555 Sherbrooke St W",
        description: "A concert hall.",
        image: { cloudinaryPublicId: "venue/abc", width: 1600, height: 900 },
      },
      contact: {
        email: "hello@example.com",
        socialLinks: [{ platform: "INSTAGRAM", url: "https://instagram.com/tedx" }],
      },
      registrationUrl: "https://example.com/tickets",
      speakers: [
        {
          id: "s1",
          name: "Ada Lovelace",
          title: "Mathematician",
          bio: "Bio.",
          talkTitle: "On engines",
          photo: { cloudinaryPublicId: "sp/1", width: 800, height: 800 },
          links: [{ platform: "X", url: "https://x.com/ada" }],
        },
      ],
      team: [{ id: "t1", name: "Sam Lee", role: "Curator", photo: null, links: [] }],
      sponsors: [
        {
          id: "sp1",
          name: "Acme",
          tier: "GOLD",
          logo: null,
          websiteUrl: "https://acme.example.com",
        },
      ],
      faqs: [{ id: "f1", question: "Is there parking?", answer: "Yes." }],
    };

    expect(eventContentSchema.safeParse(full).success).toBe(true);
  });
});

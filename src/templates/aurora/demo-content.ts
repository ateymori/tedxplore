import type { TemplateDemoSeed } from "@/templates/types";

/**
 * Aurora's demo/placeholder content (A-6).
 *
 * Seeded into every new event so the organizer's first look at the editor is a
 * complete site they edit down, not a blank form they build up (FR-10) — and
 * rendered as-is for the homepage's Live Preview (FR-50).
 *
 * The prose here is deliberate placeholder work: task 4.7 replaces it with the
 * final authored copy (and the accompanying imagery) once the template exists
 * to design against. The *shape* is what Phase 3 needs and is stable; only the
 * strings below should change.
 *
 * Every value is something an organizer would plausibly write, and nothing
 * reads as lorem ipsum: a half-edited demo that still says "Speaker One" makes
 * the site look broken, whereas a half-edited demo that says "Ada Lovelace"
 * merely looks like it belongs to someone else.
 */

/**
 * How far ahead the demo event sits.
 *
 * Far enough that the countdown reads in months rather than days — the state
 * a real organizer building their site is almost always in — and never in the
 * past, which would render the post-event state (FR-39) on a brand-new draft.
 */
const DEMO_EVENT_DAYS_AHEAD = 120;

/**
 * The time of day the demo event starts, as UTC — 14:00Z is 09:00 in
 * `America/Toronto`, which is when the FAQ below says doors open.
 *
 * Pinned rather than inherited from `now`, which would otherwise put whatever
 * minute the page happened to render at into the hero ("3:03 PM"). The date
 * still moves with `now` so the countdown never rots (FR-39); only the clock
 * time is fixed.
 */
const DEMO_EVENT_UTC_HOUR = 14;

function daysFrom(now: Date, days: number): Date {
  const date = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  date.setUTCHours(DEMO_EVENT_UTC_HOUR, 0, 0, 0);
  return date;
}

export const AURORA_DEMO_DISPLAY_NAME = "TEDxAurora Bay";

export function auroraDemoSeed(now: Date): TemplateDemoSeed {
  return {
    theme: "Ideas worth spreading, close to home",
    aboutText:
      "For one day, our community gathers to hear the people quietly reshaping how we live, " +
      "work, and look after each other. Eight talks, two performances, and a great deal of " +
      "conversation in between.",

    eventDate: daysFrom(now, DEMO_EVENT_DAYS_AHEAD),
    timezone: "America/Toronto",

    venueName: "The Mariner Theatre",
    venueAddress: "120 Harbourfront Road, Aurora Bay",
    venueDescription:
      "A restored 1920s playhouse on the waterfront, seating 480 under its original vaulted ceiling. " +
      "Doors open an hour before the first talk.",

    contactEmail: "hello@tedxaurorabay.example",
    registrationUrl: "https://example.com/tickets",
    socialLinks: [
      { platform: "INSTAGRAM", url: "https://instagram.com/example" },
      { platform: "LINKEDIN", url: "https://linkedin.com/company/example" },
    ],

    speakers: [
      {
        name: "Amara Okonjo",
        title: "Marine Biologist",
        talkTitle: "What the harbour remembers",
        bio: "Studies how coastal ecosystems recover, and why they sometimes refuse to.",
        links: [],
        sortOrder: 0,
      },
      {
        name: "Daniel Reyes",
        title: "Emergency Physician",
        talkTitle: "The first ten minutes",
        bio: "Argues that most of medicine's hardest decisions are made before anyone reaches a hospital.",
        links: [],
        sortOrder: 1,
      },
      {
        name: "Sofia Lindqvist",
        title: "Architect",
        talkTitle: "Buildings that get better with age",
        bio: "Designs for the fiftieth year of a building's life rather than its first.",
        links: [],
        sortOrder: 2,
      },
      {
        name: "Kofi Mensah",
        title: "Composer",
        talkTitle: "Writing music for a room you've never seen",
        bio: "Composes for spaces before they are built, then rewrites once he hears them.",
        links: [],
        sortOrder: 3,
      },
    ],

    teamMembers: [
      { name: "Priya Raman", role: "Licensee & Curator", links: [], sortOrder: 0 },
      { name: "Marcus Bell", role: "Production Lead", links: [], sortOrder: 1 },
      { name: "Yuki Tanaka", role: "Speaker Coach", links: [], sortOrder: 2 },
      { name: "Hannah Osei", role: "Design & Brand", links: [], sortOrder: 3 },
    ],

    sponsors: [
      {
        name: "Harbourfront Foundation",
        tier: "PARTNER",
        websiteUrl: "https://example.com",
        sortOrder: 0,
      },
      {
        name: "Northline Energy",
        tier: "PLATINUM",
        websiteUrl: "https://example.com",
        sortOrder: 1,
      },
      { name: "Baywater Press", tier: "GOLD", websiteUrl: "https://example.com", sortOrder: 2 },
      { name: "Studio Meridian", tier: "SILVER", websiteUrl: "https://example.com", sortOrder: 3 },
      { name: "The Corner Roastery", tier: "COMMUNITY", websiteUrl: null, sortOrder: 4 },
    ],

    faqs: [
      {
        question: "How long is the event?",
        answer:
          "Doors open at 9:00 and the closing remarks finish around 17:00, with a long lunch break and two intermissions.",
        sortOrder: 0,
      },
      {
        question: "Is there parking nearby?",
        answer:
          "An underground lot sits directly beneath the venue, and street parking is free after 18:00.",
        sortOrder: 1,
      },
      {
        question: "Will the talks be recorded?",
        answer:
          "Every talk is filmed and published to the TEDx channel once TED has reviewed it, usually within a few weeks.",
        sortOrder: 2,
      },
      {
        question: "Can I transfer my ticket to someone else?",
        answer:
          "Yes — email us the new attendee's name and we will update the guest list. Tickets are not resellable.",
        sortOrder: 3,
      },
    ],
  };
}

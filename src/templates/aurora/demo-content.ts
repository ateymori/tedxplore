import type { TemplateDemoSeed } from "@/templates/types";

/**
 * Aurora's demo/placeholder content (A-6).
 *
 * Seeded into every new event so the organizer's first look at the editor is a
 * complete site they edit down, not a blank form they build up (FR-10) — and
 * rendered as-is for the homepage's Live Preview (FR-50).
 *
 * Every value is something an organizer would plausibly write, and nothing
 * reads as lorem ipsum: a half-edited demo that still says "Speaker One" makes
 * the site look broken, whereas a half-edited demo that says "Ada Lovelace"
 * merely looks like it belongs to someone else.
 *
 * Two authoring rules the copy below follows, both learned the hard way:
 *
 *   - **Nothing states a count.** An About paragraph that promises "eight
 *     talks" contradicts the speakers grid the moment an organizer deletes a
 *     speaker — and it is seeded prose they did not write, so they have no
 *     reason to know it needs fixing. The same rule that keeps invented facts
 *     out of platform copy applies to the seed.
 *   - **Every list is long enough to show its own layout.** Sponsor tiers only
 *     look like tiers when at least one holds more than a single logo; a
 *     speakers grid only reads as a grid when it fills a row.
 *
 * Imagery is deliberately absent — see the note on `TemplateDemoSeed`. Demo
 * content cannot reference `MediaAsset` rows that do not exist, Cloudinary
 * uploads arrive in Phase 5, and an image-free seed means every new event
 * exercises the FR-38 hero fallback and the portrait monograms from day one.
 * The hero's default *visual* is the template's own (`AuroraBackdrop`), which
 * is where task 4.7's "default background visual" actually lives.
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
 * The time of day the demo event starts, as UTC — 14:00Z renders as a morning
 * start in `America/Toronto` (09:00 or 10:00, depending on where the moving
 * date lands relative to daylight saving).
 *
 * Pinned rather than inherited from `now`, which would otherwise put whatever
 * minute the page happened to render at into the hero ("3:03 PM"). The date
 * still moves with `now` so the countdown never rots (FR-39); only the clock
 * time is fixed.
 *
 * Which is also why no prose below quotes an exact hour: the seed's rendered
 * start time shifts by an hour twice a year, and copy that named it would be
 * wrong for half of each year.
 */
const DEMO_EVENT_UTC_HOUR = 14;

function daysFrom(now: Date, days: number): Date {
  const date = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  date.setUTCHours(DEMO_EVENT_UTC_HOUR, 0, 0, 0);
  return date;
}

export const AURORA_DEMO_DISPLAY_NAME = "TEDxAurora Bay";

/**
 * Hoisted out of the seed because the gallery poster shows it too, and a
 * poster advertising a different tagline from the site behind its Live Preview
 * button is the kind of mismatch nothing would ever catch.
 */
export const AURORA_DEMO_THEME = "Ideas worth spreading, close to home";

export function auroraDemoSeed(now: Date): TemplateDemoSeed {
  return {
    theme: AURORA_DEMO_THEME,
    aboutText:
      "TEDxAurora Bay began in a borrowed room above a bookshop, with a projector that had to be " +
      "held at the right angle to stay in focus. What has not changed since is the premise: that " +
      "the people quietly reshaping how a place lives, works, and looks after itself are usually " +
      "already here, and are rarely asked to explain what they know.\n\n" +
      "Each year we invite a handful of them onto a red circle and give them the floor. The talks " +
      "are short, unrehearsed in the ways that matter, and followed by the long, unhurried " +
      "conversations that are the real reason to come.",

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

    // Six, because the grid is three across at desktop width and a demo that
    // leaves a row half-empty reads as an unfinished site rather than as a
    // template. Every one carries a bio, so the detail dialog is discoverable
    // from any card a visitor happens to click first.
    speakers: [
      {
        name: "Amara Okonjo",
        title: "Marine Biologist",
        talkTitle: "What the harbour remembers",
        bio:
          "Amara has spent eleven years measuring the same stretch of coastline, which is long " +
          "enough to watch an ecosystem recover — and long enough to watch one decline while every " +
          "individual measurement still looks fine.\n\n" +
          "Her work on sediment memory has changed how three municipalities plan their shorelines.",
        links: [{ platform: "LINKEDIN", url: "https://linkedin.com/in/example" }],
        sortOrder: 0,
      },
      {
        name: "Daniel Reyes",
        title: "Emergency Physician",
        talkTitle: "The first ten minutes",
        bio:
          "Daniel argues that most of medicine's hardest decisions are made before anyone reaches " +
          "a hospital — by bystanders, dispatchers, and paramedics working from incomplete " +
          "information under a clock.\n\n" +
          "He trains first responders across the region and is unreasonably interested in how " +
          "checklists are worded.",
        links: [],
        sortOrder: 1,
      },
      {
        name: "Sofia Lindqvist",
        title: "Architect",
        talkTitle: "Buildings that get better with age",
        bio:
          "Sofia designs for the fiftieth year of a building's life rather than its first, which " +
          "turns out to change almost every decision: the materials, the joinery, and above all " +
          "how easy it is to take a wall down again.",
        links: [
          { platform: "INSTAGRAM", url: "https://instagram.com/example" },
          { platform: "WEBSITE", url: "https://example.com" },
        ],
        sortOrder: 2,
      },
      {
        name: "Kofi Mensah",
        title: "Composer",
        talkTitle: "Writing music for a room you've never seen",
        bio:
          "Kofi writes for concert halls that are still drawings, working from acoustic models and " +
          "a great deal of guesswork — then rewrites once he finally hears the room.\n\n" +
          "He describes the gap between the two as the most honest feedback he has ever received.",
        links: [],
        sortOrder: 3,
      },
      {
        name: "Neve Ó Braonáin",
        title: "Union Organizer",
        talkTitle: "The meeting after the meeting",
        bio:
          "Neve has organized dockworkers, nurses, and one memorable orchestra. She is interested " +
          "in the informal conversation that happens once the official one ends, and in what it " +
          "means when a workplace no longer has anywhere for that conversation to occur.",
        links: [{ platform: "LINKEDIN", url: "https://linkedin.com/in/example" }],
        sortOrder: 4,
      },
      {
        name: "Ruben Castellanos",
        title: "Schoolteacher",
        talkTitle: "Teaching a subject you are still bad at",
        bio:
          "After fifteen years teaching mathematics, Ruben started learning to draw in front of " +
          "his students — badly, on purpose, and out loud.\n\n" +
          "What happened to the room afterwards is the reason he is giving this talk.",
        links: [],
        sortOrder: 5,
      },
    ],

    teamMembers: [
      {
        name: "Priya Raman",
        role: "Licensee & Curator",
        links: [{ platform: "LINKEDIN", url: "https://linkedin.com/in/example" }],
        sortOrder: 0,
      },
      { name: "Marcus Bell", role: "Production Lead", links: [], sortOrder: 1 },
      { name: "Yuki Tanaka", role: "Speaker Coach", links: [], sortOrder: 2 },
      {
        name: "Hannah Osei",
        role: "Design & Brand",
        links: [{ platform: "INSTAGRAM", url: "https://instagram.com/example" }],
        sortOrder: 3,
      },
    ],

    // Spread across five of the six tiers, with two names sharing GOLD: a tier
    // holding exactly one sponsor everywhere makes the grouping look like a
    // list, and the demo's job is to show the organizer that tiers exist and
    // that empty ones simply vanish (BR-13).
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
      { name: "Meridian & Co.", tier: "GOLD", websiteUrl: "https://example.com", sortOrder: 3 },
      { name: "Studio Halyard", tier: "SILVER", websiteUrl: "https://example.com", sortOrder: 4 },
      { name: "The Corner Roastery", tier: "COMMUNITY", websiteUrl: null, sortOrder: 5 },
    ],

    faqs: [
      {
        question: "How long is the event?",
        answer:
          "The programme runs from the first talk in the morning through to closing remarks in the " +
          "late afternoon, with a long lunch break and two intermissions. Most people stay for the " +
          "reception afterwards.",
        sortOrder: 0,
      },
      {
        question: "Is the venue accessible?",
        answer:
          "Yes. The entrance, auditorium, and washrooms are step-free, and there is reserved " +
          "wheelchair seating at the front and rear of the hall. Tell us what you need when you " +
          "book and we will arrange it.",
        sortOrder: 1,
      },
      {
        question: "Is there parking nearby?",
        answer:
          "An underground lot sits directly beneath the venue, and street parking on Harbourfront " +
          "Road is free at weekends.",
        sortOrder: 2,
      },
      {
        question: "Will the talks be recorded?",
        answer:
          "Every talk is filmed and published to the TEDx channel once TED has reviewed it, " +
          "usually within a few weeks of the event.",
        sortOrder: 3,
      },
      {
        question: "Can I transfer my ticket to someone else?",
        answer:
          "Yes — email us the new attendee's name and we will update the guest list. Tickets are " +
          "not resellable.",
        sortOrder: 4,
      },
    ],
  };
}

import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  ABOUT_TED,
  ABOUT_TEDX,
  DEFAULT_HERO_SUBTITLE,
  TEDX_DISCLAIMER,
} from "@/config/platform-copy";
import { draftToEventContent, type EventDraft } from "@/content/serializer";
import { auroraNavItems, AURORA_SECTION_IDS } from "@/templates/aurora/sections";
import { AuroraRenderer } from "@/templates/aurora/renderer";
import { findTemplate } from "@/templates/registry";
import { demoContent } from "@/templates/types";

/**
 * Task 4.7's fallback verification, and the reason it is its own file.
 *
 * Aurora has *two* behaviours for absent content, they look superficially
 * alike, and confusing them is the most expensive mistake this template can
 * make:
 *
 *   - **FR-38 — always-rendered content falls back.** The Hero renders for
 *     every event in every state. A blank Theme shows platform default copy; an
 *     absent hero image shows the template's own visual. The section never
 *     disappears and never looks broken.
 *   - **BR-13 — optional sections disappear.** Speakers, Venue, Team,
 *     Sponsors, FAQ, About, Contact hide entirely when empty, and *nothing* is
 *     substituted. A "no speakers announced yet" placeholder would be a bug: it
 *     is content we invented on the organizer's behalf.
 *
 * The tests below assert both directions against the real renderer, because
 * this is a rule about rendered output — `sectionVisibility` unit tests
 * (serializer.test.ts) prove the predicate, not that Aurora obeys it.
 *
 * Rendering is `renderToStaticMarkup`, which is also the point: it runs no
 * effects and no client JavaScript, so everything asserted here is in the
 * server-rendered HTML (NFR-1).
 */

const NOW = new Date("2026-01-15T12:00:00.000Z");

/** A draft with only what event creation requires (FR-8): a display name. */
function minimalDraft(overrides: Partial<EventDraft> = {}): EventDraft {
  return {
    displayName: "TEDxMinimal",
    theme: null,
    aboutText: null,
    eventDate: null,
    timezone: null,
    venueName: null,
    venueAddress: null,
    venueDescription: null,
    contactEmail: null,
    registrationUrl: null,
    socialLinks: [],
    heroImage: null,
    venueImage: null,
    speakers: [],
    teamMembers: [],
    sponsors: [],
    faqs: [],
    ...overrides,
  };
}

function render(draft: EventDraft): string {
  return renderToStaticMarkup(
    <AuroraRenderer content={draftToEventContent(draft)} mode="preview" now={NOW} />,
  );
}

/** `id="speakers"` — the anchor `AuroraSection` puts on every optional section. */
function hasSection(html: string, key: keyof typeof AURORA_SECTION_IDS): boolean {
  return html.includes(`id="${AURORA_SECTION_IDS[key]}"`);
}

describe("FR-38: the Hero falls back rather than emptying", () => {
  const html = render(minimalDraft());

  it("renders the display name, the only field that is always present", () => {
    expect(html).toContain("TEDxMinimal");
  });

  it("substitutes platform default copy for a blank Theme (BR-5d)", () => {
    expect(html).toContain(DEFAULT_HERO_SUBTITLE);
  });

  it("shows the organizer's Theme instead once they set one", () => {
    const themed = render(minimalDraft({ theme: "Ideas worth spreading, close to home" }));

    expect(themed).toContain("Ideas worth spreading, close to home");
    // Both at once would read as a subtitle and a tagline stacked on top of
    // each other — the fallback is a replacement, not an addition.
    expect(themed).not.toContain(DEFAULT_HERO_SUBTITLE);
  });

  it("substitutes the template's own visual for absent hero imagery", () => {
    // `aurora-veil` is `AuroraBackdrop`'s colour field: present means the
    // default visual rendered, so the hero is never a flat empty box.
    expect(html).toContain("aurora-veil");
  });

  it("renders no <img> at all when nothing has been uploaded", () => {
    expect(html).not.toContain("<img");
  });

  it("keeps the Hero's optional furniture optional", () => {
    // The date, countdown, and Get-tickets button are *not* FR-38 content.
    // Absent means absent; only the Theme and the visual fall back.
    expect(html).not.toContain("Get tickets");
  });
});

describe("BR-13: optional sections disappear, with nothing put in their place", () => {
  const html = render(minimalDraft());

  it.each(Object.keys(AURORA_SECTION_IDS) as (keyof typeof AURORA_SECTION_IDS)[])(
    "omits the %s section entirely",
    (key) => {
      expect(hasSection(html, key)).toBe(false);
    },
  );

  it("offers no nav links, because there is nowhere to scroll to", () => {
    expect(auroraNavItems(draftToEventContent(minimalDraft()))).toEqual([]);
  });

  it("invents no placeholder copy for the sections it hid", () => {
    // The failure this guards against is a well-meaning "Speakers to be
    // announced" — content the organizer never wrote, on their public site.
    for (const heading of ["Speakers", "Sponsors", "Venue", "Team", "Contact"]) {
      expect(html).not.toContain(`>${heading}<`);
    }
  });

  it("hides a section whose only content is whitespace", () => {
    // The serializer normalizes blank-but-present to null, so "empty" and
    // "spaces" are the same state — verified here through the renderer because
    // that equivalence is what stops a stray keystroke from publishing an
    // empty About section.
    expect(hasSection(render(minimalDraft({ aboutText: "   \n  " })), "about")).toBe(false);
  });

  it("brings a section back the moment it has content", () => {
    const withAbout = render(minimalDraft({ aboutText: "We have been doing this since 2016." }));

    expect(hasSection(withAbout, "about")).toBe(true);
    expect(withAbout).toContain("We have been doing this since 2016.");
  });
});

describe("the two rules do not interfere with each other", () => {
  it("renders a complete site from a draft with nothing but a display name", () => {
    const html = render(minimalDraft());

    // The site is still whole: hero, the licensing copy, and a footer. This is
    // the Phase 4 exit criterion — a minimal draft must not look unfinished.
    expect(html).toContain(ABOUT_TED.heading);
    expect(html).toContain(ABOUT_TEDX.heading);
    expect(html).toContain(TEDX_DISCLAIMER);
  });

  it("renders every optional section for the fully populated demo", () => {
    const aurora = findTemplate("aurora");
    if (aurora === null) throw new Error("aurora is not registered");

    const html = renderToStaticMarkup(
      <AuroraRenderer content={demoContent(aurora, NOW)} mode="demo" now={NOW} />,
    );

    for (const key of Object.keys(AURORA_SECTION_IDS) as (keyof typeof AURORA_SECTION_IDS)[]) {
      expect(hasSection(html, key)).toBe(true);
    }

    // The demo has no imagery either (Cloudinary is Phase 5), so it exercises
    // the same hero fallback a real new event does.
    expect(html).toContain("aurora-veil");
  });
});

describe("an unconfigured Cloudinary falls back instead of breaking", () => {
  it("shows the default visual when a hero image exists but has no cloud to serve from", () => {
    // `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` is unset in tests, which is exactly
    // the deployment mistake this guards: a broken-image icon on a published
    // hero is worse than the fallback.
    const html = render(
      minimalDraft({ heroImage: { cloudinaryPublicId: "events/hero", width: 2400, height: 1350 } }),
    );

    expect(html).toContain("aurora-veil");
    expect(html).not.toContain("<img");
  });
});

describe("with Cloudinary configured, uploaded imagery replaces the fallback", () => {
  let html: string;

  beforeAll(async () => {
    // The cloud name is read once at module scope, so the modules under test
    // have to be re-imported after it is set.
    vi.stubEnv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", "demo-cloud");
    vi.resetModules();

    const [{ AuroraRenderer: Renderer }, { draftToEventContent: serialize }] = await Promise.all([
      import("@/templates/aurora/renderer"),
      import("@/content/serializer"),
    ]);

    html = renderToStaticMarkup(
      <Renderer
        content={serialize(
          minimalDraft({
            heroImage: { cloudinaryPublicId: "events/hero", width: 2400, height: 1350 },
          }),
        )}
        mode="preview"
        now={NOW}
      />,
    );
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("serves the uploaded hero", () => {
    expect(html).toContain("res.cloudinary.com/demo-cloud");
  });

  it("drops the default visual, rather than stacking both", () => {
    expect(html).not.toContain("aurora-veil");
  });

  it("marks the hero decorative — the display name over it already names it", () => {
    expect(html).toContain('alt=""');
  });
});

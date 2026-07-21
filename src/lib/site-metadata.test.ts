import { afterEach, describe, expect, it, vi } from "vitest";

import type { EventContent } from "@/content/event-content";
import { emptyEventContent } from "@/content/event-content";
import { siteCardImage, siteDescription } from "./site-metadata";

function content(overrides: Partial<EventContent> = {}): EventContent {
  return { ...emptyEventContent("TEDxAvelorne"), ...overrides };
}

describe("siteDescription", () => {
  it("prefers the theme — it is the organizer's own one-line summary", () => {
    expect(siteDescription(content({ theme: "Ideas worth spreading, close to home" }))).toBe(
      "Ideas worth spreading, close to home",
    );
  });

  it("falls back to the About text when there is no theme", () => {
    expect(siteDescription(content({ about: "A day of talks in the old town hall." }))).toBe(
      "A day of talks in the old town hall.",
    );
  });

  it("collapses the newlines a multi-paragraph About carries", () => {
    // A raw `\n\n` in a meta tag renders as a gap in some search snippets.
    expect(siteDescription(content({ about: "First para.\n\nSecond para." }))).toBe(
      "First para. Second para.",
    );
  });

  it("returns null when the organizer wrote neither", () => {
    // Deliberately not substituting platform copy about TEDx in general: a
    // shared link describing the movement rather than the event reads as a
    // stub, and Google can write a better snippet from the page itself.
    expect(siteDescription(content())).toBeNull();
  });

  it("treats whitespace-only fields as absent", () => {
    expect(siteDescription(content({ theme: "   ", about: "  \n " }))).toBeNull();
  });

  it("truncates long text at a word boundary, never mid-word", () => {
    const about = `${"word ".repeat(80)}end`;
    const result = siteDescription(content({ about }));

    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(200);
    expect(result!.endsWith("…")).toBe(true);
    // The cut landed between words, so nothing before the ellipsis is a fragment.
    expect(result!.slice(0, -1).endsWith("word")).toBe(true);
  });

  it("does not add an ellipsis to text that fit", () => {
    // An ellipsis on a complete description is a small lie about there being more.
    expect(siteDescription(content({ theme: "Short." }))).toBe("Short.");
  });

  it("hard-cuts a single word longer than the limit", () => {
    const result = siteDescription(content({ about: "x".repeat(300) }));
    expect(result).toHaveLength(200);
  });
});

describe("siteCardImage", () => {
  const heroImage = { cloudinaryPublicId: "events/e1/hero", width: 2400, height: 1600 };

  it("returns null when the event has no hero image", () => {
    // Only the hero is considered — cropping a speaker portrait to a card
    // would misrepresent whose event it is.
    expect(siteCardImage(content())).toBeNull();
  });

  it("returns null when Cloudinary is unconfigured", () => {
    // The env var is unset in tests, which is the same degradation every other
    // image path takes: a text card beats a card pointing at a broken URL.
    expect(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME).toBeUndefined();
    expect(siteCardImage(content({ heroImage }))).toBeNull();
  });

  describe("with Cloudinary configured", () => {
    /**
     * `cloudinary-url.ts` reads the cloud name once at module scope, so the
     * env has to be stubbed and the module graph reset before importing —
     * setting the variable alone would come too late.
     */
    async function withCloudName() {
      vi.stubEnv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", "test-cloud");
      vi.resetModules();
      return import("./site-metadata");
    }

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it("requests a cropped image at the standard card size", async () => {
      const { siteCardImage: build } = await withCloudName();
      const card = build(content({ heroImage }));

      expect(card).not.toBeNull();
      // `c_fill` + `g_auto` because the platforms crop whatever they are given;
      // doing it here at least puts the subject in the frame.
      expect(card!.url).toContain("c_fill");
      expect(card!.url).toContain("g_auto");
      expect(card!.url).toContain("w_1200");
      expect(card!.url).toContain("h_630");
    });

    it("describes the image with the display name", async () => {
      // `EventContent` images carry no alt text (Phase 1) because the page
      // always has adjacent describing content — but a social card is *only*
      // the image, so it needs one.
      const { siteCardImage: build } = await withCloudName();

      expect(build(content({ heroImage }))!.alt).toBe("TEDxAvelorne");
    });
  });
});

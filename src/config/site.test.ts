import { describe, expect, it } from "vitest";

import { parseTedxSegment, tedxSitePath, tedxSiteSegment, tedxSiteUrl } from "./site";

describe("tedxSitePath", () => {
  it("builds a path on the main site, not a subdomain (BR-2)", () => {
    expect(tedxSitePath("mcgillu")).toBe("/tedxmcgillu");
  });

  it("builds an absolute URL under the app's own origin", () => {
    expect(tedxSiteUrl("mcgillu")).toBe("http://localhost:3000/tedxmcgillu");
  });
});

describe("tedxSiteSegment", () => {
  it("builds the bare route segment, with no leading slash", () => {
    // This is the value `generateStaticParams` hands the `[site]` param; a
    // leading slash there would prerender a path that never matches.
    expect(tedxSiteSegment("mcgillu")).toBe("tedxmcgillu");
  });

  it("round-trips with parseTedxSegment", () => {
    for (const slug of ["mcgillu", "demoevent", "ab", "plore"]) {
      expect(parseTedxSegment(tedxSiteSegment(slug))).toBe(slug);
    }
  });
});

describe("parseTedxSegment", () => {
  it("round-trips with tedxSitePath", () => {
    // The two directions must agree; this is the guard against them drifting.
    for (const slug of ["mcgillu", "demoevent", "ab"]) {
      expect(parseTedxSegment(tedxSitePath(slug).slice(1))).toBe(slug);
    }
  });

  it("extracts the slug from a full route segment", () => {
    expect(parseTedxSegment("tedxmcgillu")).toBe("mcgillu");
  });

  it("rejects segments that aren't event URLs", () => {
    expect(parseTedxSegment("dashboard")).toBeNull();
    expect(parseTedxSegment("about")).toBeNull();
    expect(parseTedxSegment("")).toBeNull();
  });

  it("rejects the bare prefix — /tedx is not an event", () => {
    expect(parseTedxSegment("tedx")).toBeNull();
  });

  it("keeps the platform's own name parseable as a slug, so the blocklist can reject it", () => {
    // `/tedxplore` must not resolve to an event; that is enforced by the
    // reserved-slug blocklist, not by this shape check.
    expect(parseTedxSegment("tedxplore")).toBe("plore");
  });
});

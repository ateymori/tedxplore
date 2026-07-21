import { describe, expect, it } from "vitest";

import { clientIpFrom } from "./client-ip";

function headers(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe("clientIpFrom", () => {
  it("takes the first entry of x-forwarded-for, not the last", () => {
    // The one that matters. Each proxy appends itself, so the last entry is our
    // own edge — reading it would put all traffic in a single rate-limit
    // bucket, a total failure that still looks like it works.
    expect(
      clientIpFrom(headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" })),
    ).toBe("203.0.113.7");
  });

  it("handles a single-entry chain", () => {
    expect(clientIpFrom(headers({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("trims the whitespace proxies leave after commas", () => {
    expect(clientIpFrom(headers({ "x-forwarded-for": "  203.0.113.7 , 70.41.3.18" }))).toBe(
      "203.0.113.7",
    );
  });

  it("falls back to x-real-ip when there is no forwarded chain", () => {
    expect(clientIpFrom(headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("prefers x-forwarded-for over x-real-ip", () => {
    expect(
      clientIpFrom(headers({ "x-forwarded-for": "203.0.113.7", "x-real-ip": "203.0.113.9" })),
    ).toBe("203.0.113.7");
  });

  it("returns null when neither header is present", () => {
    // Must stay null rather than a sentinel: a shared fallback value would put
    // every anonymous visitor in one bucket, letting one actor exhaust the
    // limit for everybody.
    expect(clientIpFrom(headers({}))).toBeNull();
  });

  it("returns null for empty or whitespace-only headers", () => {
    expect(clientIpFrom(headers({ "x-forwarded-for": "" }))).toBeNull();
    expect(clientIpFrom(headers({ "x-forwarded-for": "   " }))).toBeNull();
    expect(clientIpFrom(headers({ "x-real-ip": "  " }))).toBeNull();
  });

  it("falls through to x-real-ip when the forwarded chain is blank", () => {
    expect(clientIpFrom(headers({ "x-forwarded-for": "  ", "x-real-ip": "203.0.113.9" }))).toBe(
      "203.0.113.9",
    );
  });
});

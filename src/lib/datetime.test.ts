import { describe, expect, it } from "vitest";

import { isValidTimeZone, utcToZonedWallTime, zonedWallTimeToUtc } from "./datetime";

describe("isValidTimeZone", () => {
  it("accepts IANA zone names", () => {
    expect(isValidTimeZone("America/Toronto")).toBe(true);
    expect(isValidTimeZone("Europe/Paris")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  it("accepts legacy link names, which browsers still hand us", () => {
    expect(isValidTimeZone("US/Eastern")).toBe(true);
  });

  it("rejects unknown zones and blanks", () => {
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
    expect(isValidTimeZone("EST5EDT_NOT_REAL")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("   ")).toBe(false);
  });
});

describe("zonedWallTimeToUtc", () => {
  it("applies a standard-time offset", () => {
    // Toronto is UTC-5 in November.
    const instant = zonedWallTimeToUtc("2026-11-14T18:00", "America/Toronto");
    expect(instant?.toISOString()).toBe("2026-11-14T23:00:00.000Z");
  });

  it("applies a daylight-saving offset for the same zone", () => {
    // Toronto is UTC-4 in July — the whole point of resolving the offset at
    // the instant rather than assuming one per zone.
    const instant = zonedWallTimeToUtc("2026-07-14T18:00", "America/Toronto");
    expect(instant?.toISOString()).toBe("2026-07-14T22:00:00.000Z");
  });

  it("handles zones ahead of UTC", () => {
    const instant = zonedWallTimeToUtc("2026-03-01T09:30", "Asia/Tokyo");
    expect(instant?.toISOString()).toBe("2026-03-01T00:30:00.000Z");
  });

  it("handles half-hour and three-quarter-hour offsets", () => {
    expect(zonedWallTimeToUtc("2026-03-01T12:00", "Asia/Kolkata")?.toISOString()).toBe(
      "2026-03-01T06:30:00.000Z",
    );
    expect(zonedWallTimeToUtc("2026-03-01T12:00", "Asia/Kathmandu")?.toISOString()).toBe(
      "2026-03-01T06:15:00.000Z",
    );
  });

  it("resolves a wall time one hour after a spring-forward transition", () => {
    // US DST 2026 starts 2026-03-08 at 02:00 local. 03:00 exists and is EDT.
    const instant = zonedWallTimeToUtc("2026-03-08T03:00", "America/Toronto");
    expect(instant?.toISOString()).toBe("2026-03-08T07:00:00.000Z");
  });

  it("resolves a wall time inside the fall-back repeated hour to the first pass", () => {
    // 2026-11-01 01:30 happens twice in Toronto; the earlier (EDT) reading is
    // the one a two-pass resolution lands on, and is what every date library
    // returns for the ambiguous case.
    const instant = zonedWallTimeToUtc("2026-11-01T01:30", "America/Toronto");
    expect(instant?.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("rejects malformed wall times", () => {
    expect(zonedWallTimeToUtc("2026-11-14", "UTC")).toBeNull();
    expect(zonedWallTimeToUtc("14/11/2026 18:00", "UTC")).toBeNull();
    expect(zonedWallTimeToUtc("2026-11-14T18:00:00", "UTC")).toBeNull();
    expect(zonedWallTimeToUtc("", "UTC")).toBeNull();
  });

  it("rejects out-of-range times", () => {
    expect(zonedWallTimeToUtc("2026-11-14T24:00", "UTC")).toBeNull();
    expect(zonedWallTimeToUtc("2026-11-14T18:60", "UTC")).toBeNull();
  });

  it("rejects dates that do not exist rather than rolling them forward", () => {
    expect(zonedWallTimeToUtc("2026-02-30T12:00", "UTC")).toBeNull();
    expect(zonedWallTimeToUtc("2026-13-01T12:00", "UTC")).toBeNull();
    // 2026 is not a leap year.
    expect(zonedWallTimeToUtc("2026-02-29T12:00", "UTC")).toBeNull();
    expect(zonedWallTimeToUtc("2028-02-29T12:00", "UTC")).not.toBeNull();
  });

  it("rejects an unknown zone", () => {
    expect(zonedWallTimeToUtc("2026-11-14T18:00", "Mars/Olympus_Mons")).toBeNull();
  });
});

describe("utcToZonedWallTime", () => {
  it("renders an instant in the requested zone", () => {
    const instant = new Date("2026-11-14T23:00:00.000Z");
    expect(utcToZonedWallTime(instant, "America/Toronto")).toBe("2026-11-14T18:00");
  });

  it("crosses the date boundary correctly", () => {
    const instant = new Date("2026-03-01T00:30:00.000Z");
    expect(utcToZonedWallTime(instant, "Asia/Tokyo")).toBe("2026-03-01T09:30");
    expect(utcToZonedWallTime(instant, "America/Toronto")).toBe("2026-02-28T19:30");
  });

  it("renders midnight as 00:00, never 24:00", () => {
    const instant = new Date("2026-11-15T05:00:00.000Z");
    expect(utcToZonedWallTime(instant, "America/Toronto")).toBe("2026-11-15T00:00");
  });

  it("returns null for an invalid instant or zone", () => {
    expect(utcToZonedWallTime(new Date(Number.NaN), "UTC")).toBeNull();
    expect(utcToZonedWallTime(new Date(), "Mars/Olympus_Mons")).toBeNull();
  });

  it("round-trips through zonedWallTimeToUtc", () => {
    // Opening the editor and saving without touching the field must not drift
    // the event's time — which is only true if these two are exact inverses.
    const cases: [string, string][] = [
      ["2026-11-14T18:00", "America/Toronto"],
      ["2026-07-04T09:15", "America/Toronto"],
      ["2026-01-31T23:45", "Asia/Kathmandu"],
      ["2026-06-15T00:00", "Australia/Sydney"],
      ["2026-12-25T12:00", "UTC"],
    ];

    for (const [wallTime, timeZone] of cases) {
      const instant = zonedWallTimeToUtc(wallTime, timeZone);
      expect(instant).not.toBeNull();
      expect(utcToZonedWallTime(instant as Date, timeZone)).toBe(wallTime);
    }
  });
});

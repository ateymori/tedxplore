import { describe, expect, it } from "vitest";

import { countdownLabel, countdownParts, formatEventDate, formatEventTime } from "./event-date";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("countdownParts", () => {
  const now = Date.UTC(2026, 0, 1, 0, 0, 0);

  it("breaks the remaining time into units", () => {
    const target = now + 3 * DAY + 4 * HOUR + 5 * MINUTE + 6 * SECOND;

    expect(countdownParts(target, now)).toEqual({
      days: 3,
      hours: 4,
      minutes: 5,
      seconds: 6,
    });
  });

  it("does not roll a unit over until it is complete", () => {
    // One second short of two days: still 1 day, 23:59:59 — an off-by-one here
    // would show "2 days" for a whole second before dropping back.
    expect(countdownParts(now + 2 * DAY - SECOND, now)).toEqual({
      days: 1,
      hours: 23,
      minutes: 59,
      seconds: 59,
    });
  });

  it("counts down past 24 hours in days, not hours", () => {
    expect(countdownParts(now + 100 * DAY, now)?.days).toBe(100);
  });

  // FR-39: the post-event state is signalled by `null`, never by a zeroed or
  // negative clock.
  it("returns null exactly at the event instant", () => {
    expect(countdownParts(now, now)).toBeNull();
  });

  it("returns null once the event has passed", () => {
    expect(countdownParts(now - SECOND, now)).toBeNull();
    expect(countdownParts(now - 400 * DAY, now)).toBeNull();
  });

  it("is still counting one second before the event", () => {
    expect(countdownParts(now + SECOND, now)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 1,
    });
  });
});

describe("countdownLabel", () => {
  it("reads out every unit down to minutes", () => {
    expect(countdownLabel({ days: 3, hours: 4, minutes: 5, seconds: 6 })).toBe(
      "3 days, 4 hours, 5 minutes until the event",
    );
  });

  it("singularizes", () => {
    expect(countdownLabel({ days: 1, hours: 1, minutes: 1, seconds: 0 })).toBe(
      "1 day, 1 hour, 1 minute until the event",
    );
  });

  it("drops leading zero units", () => {
    expect(countdownLabel({ days: 0, hours: 2, minutes: 30, seconds: 0 })).toBe(
      "2 hours, 30 minutes until the event",
    );
    expect(countdownLabel({ days: 0, hours: 0, minutes: 45, seconds: 0 })).toBe(
      "45 minutes until the event",
    );
  });

  it("keeps interior zero units, which carry meaning", () => {
    expect(countdownLabel({ days: 2, hours: 0, minutes: 30, seconds: 0 })).toBe(
      "2 days, 0 hours, 30 minutes until the event",
    );
  });

  it("falls back to minutes when the event is under a minute away", () => {
    expect(countdownLabel({ days: 0, hours: 0, minutes: 0, seconds: 12 })).toBe(
      "0 minutes until the event",
    );
  });
});

describe("event date formatting", () => {
  // 15:30 UTC on 2026-11-15 — 10:30 in Toronto, which is also a different
  // *date* in some zones, so this pins the "display in the event's timezone,
  // not the viewer's" rule.
  const startsAt = "2026-11-15T15:30:00.000Z";

  it("formats the date in the event's timezone", () => {
    expect(formatEventDate(startsAt, "America/Toronto")).toBe("Sunday, November 15, 2026");
  });

  it("can land on a different calendar day than UTC", () => {
    expect(formatEventDate("2026-11-15T23:30:00.000Z", "America/Toronto")).toBe(
      "Sunday, November 15, 2026",
    );
    expect(formatEventDate("2026-11-15T23:30:00.000Z", "Asia/Tokyo")).toBe(
      "Monday, November 16, 2026",
    );
  });

  it("includes the zone abbreviation, without which the time is ambiguous", () => {
    expect(formatEventTime(startsAt, "America/Toronto")).toBe("10:30 AM EST");
  });

  // A draft can carry a date with no timezone (both fields are independently
  // optional, FR-15a). UTC is a deterministic choice; the runtime default is
  // not, and would differ between the server render and the browser.
  it("falls back to UTC rather than the runtime timezone", () => {
    expect(formatEventTime(startsAt, null)).toBe("3:30 PM UTC");
    expect(formatEventDate(startsAt, null)).toBe("Sunday, November 15, 2026");
  });
});

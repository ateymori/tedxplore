/**
 * Event date formatting and countdown arithmetic.
 *
 * Pure functions, separate from the components that use them, because the
 * countdown is the one piece of Aurora with real logic to get wrong — leap
 * seconds aside, "3 days, 0 hours, 4 minutes" has to be right at every
 * boundary, and that is a unit test, not a visual check.
 *
 * Locale is pinned to `en-US` for the same reason as `lib/format.ts`: V1 is
 * English-only (A-3), and an unpinned locale renders differently on the server
 * and in the browser, which React reports as a hydration mismatch.
 */

const LOCALE = "en-US";

/**
 * `EventContent` carries the instant as UTC and the organizer's IANA timezone
 * separately (see `eventScheduleContentSchema`). Displaying the instant in the
 * event's own timezone — not the visitor's — is the whole reason the timezone
 * travels with it: an attendee in another country needs to know when doors
 * open *there*.
 *
 * A missing timezone falls back to UTC rather than to the runtime default,
 * which would differ between the server and the visitor's browser.
 */
function zone(timezone: string | null): string {
  return timezone ?? "UTC";
}

/** "Saturday, November 15, 2026" */
export function formatEventDate(startsAt: string, timezone: string | null): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: zone(timezone),
  }).format(new Date(startsAt));
}

/** "9:00 AM EST" — the zone abbreviation is included because the time is
 * meaningless to a remote reader without it. */
export function formatEventTime(startsAt: string, timezone: string | null): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: zone(timezone),
  }).format(new Date(startsAt));
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Time remaining until the event, or `null` once it has started.
 *
 * `null` is the FR-39 signal: the caller renders "This event has taken place."
 * rather than a zeroed or negative clock. The boundary is inclusive of the
 * start instant — at exactly the event time the countdown is over, not showing
 * all zeros.
 *
 * Both arguments are milliseconds so the function has no opinion about where
 * "now" comes from; the component ticks it, the tests pin it.
 */
export function countdownParts(targetMs: number, nowMs: number): CountdownParts | null {
  const remaining = targetMs - nowMs;
  if (remaining <= 0) return null;

  return {
    days: Math.floor(remaining / DAY),
    hours: Math.floor((remaining % DAY) / HOUR),
    minutes: Math.floor((remaining % HOUR) / MINUTE),
    seconds: Math.floor((remaining % MINUTE) / SECOND),
  };
}

/**
 * A screen-reader sentence for the countdown.
 *
 * The visual clock is four numbers under four abbreviated labels, which reads
 * as "12 0 4 3 3 0" aloud. The grid is therefore hidden from assistive tech and
 * this sentence is announced in its place (NFR-3). Zero-valued leading units
 * are dropped — "0 days, 4 hours" is noise.
 */
export function countdownLabel(parts: CountdownParts): string {
  const units: [number, string][] = [
    [parts.days, "day"],
    [parts.hours, "hour"],
    [parts.minutes, "minute"],
  ];

  // Only *leading* zeros are dropped: "2 days, 0 hours, 30 minutes" is worth
  // saying in full, because skipping the middle unit would read as 2 days and
  // 30 minutes' worth of something else. When everything is zero the event is
  // under a minute away, and "0 minutes" is the honest thing to announce.
  const firstMeaningful = units.findIndex(([value]) => value > 0);
  const spoken = units
    .slice(firstMeaningful === -1 ? units.length - 1 : firstMeaningful)
    .map(([value, unit]) => `${value} ${unit}${value === 1 ? "" : "s"}`);

  return `${spoken.join(", ")} until the event`;
}

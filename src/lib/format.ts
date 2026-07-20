/**
 * Display formatting helpers.
 *
 * Locale is pinned to `en-US` rather than left to the runtime: A-3 makes V1
 * English-only, and an unpinned locale formats differently on the server and
 * in the browser, which React reports as a hydration mismatch.
 */

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

const relative = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

/**
 * "3 days ago", "in 2 months".
 *
 * `now` is a parameter so callers can pin it — a default of `new Date()` makes
 * every consumer untestable and, in a server component, bakes render time into
 * the output in a way that is easy to forget.
 */
export function formatRelativeTime(date: Date, now: Date): string {
  const elapsed = date.getTime() - now.getTime();
  const magnitude = Math.abs(elapsed);

  for (const [unit, ms] of UNITS) {
    if (magnitude >= ms) {
      return relative.format(Math.round(elapsed / ms), unit);
    }
  }

  return "just now";
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

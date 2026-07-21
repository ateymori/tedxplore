/**
 * Wall time ↔ instant conversion.
 *
 * The editor asks the organizer two separate questions — "what date and time?"
 * and "in which timezone?" — because that is how they think about their event:
 * doors open at 6pm *in Toronto*, regardless of where the person filling in the
 * form happens to be sitting. `EventContent` stores the answer as an absolute
 * UTC instant plus the IANA zone name (see `eventScheduleContentSchema`), so
 * something has to turn "2026-11-14, 18:00, America/Toronto" into an instant
 * and back again.
 *
 * Hand-rolled on `Intl` rather than pulled from a date library: this is the
 * only place in the app that needs zone arithmetic, the algorithm is thirty
 * lines, and `Intl` is the same IANA database a library would wrap. The DST
 * boundaries are the part worth getting right, and those are unit tests.
 *
 * Temporal would make this a one-liner; revisit when its browser and Node
 * baseline is safe to depend on without a polyfill.
 */

/** What `<input type="datetime-local">` produces and consumes. */
const WALL_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Whether a string names a zone this runtime knows.
 *
 * `Intl.DateTimeFormat` throws `RangeError` for an unknown zone, which is the
 * only portable way to ask — `Intl.supportedValuesOf("timeZone")` exists but
 * omits the link/alias names ("US/Eastern", "Asia/Calcutta") that browsers
 * still accept and that a pasted value may well contain.
 */
export function isValidTimeZone(timeZone: string): boolean {
  if (timeZone.trim().length === 0) return false;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The zone's UTC offset, in milliseconds, at a given instant.
 *
 * Positive east of Greenwich. Derived by formatting the instant *in* the zone
 * and reading the result back as though it were UTC: the difference between
 * that and the true instant is exactly the offset. This is the standard trick,
 * and it is correct across DST because it asks the zone database about one
 * specific moment rather than assuming a fixed offset.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const field = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((candidate) => candidate.type === type);
    return part === undefined ? 0 : Number(part.value);
  };

  const asIfUtc = Date.UTC(
    field("year"),
    field("month") - 1,
    field("day"),
    field("hour"),
    field("minute"),
    field("second"),
  );

  // `formatToParts` has no millisecond field, so the reconstructed value is
  // truncated to the second. Compare against a likewise-truncated instant or
  // every offset comes back off by the sub-second remainder.
  return asIfUtc - (instant.getTime() - instant.getMilliseconds());
}

/**
 * "2026-11-14T18:00" in "America/Toronto" → the UTC instant it denotes.
 *
 * Returns `null` for a malformed wall time, an unknown zone, or a date that
 * doesn't exist on the calendar (`2026-02-30`) — all three are ordinary bad
 * input from a hand-edited field, not exceptions.
 *
 * Two passes, because the offset depends on the very instant being computed:
 * the first guess uses the offset in effect at the wall time read as UTC, the
 * second re-reads the offset at that guess. That converges everywhere except
 * inside the one-hour gap a spring-forward transition deletes, where no
 * instant matches the requested wall time; there the result lands just past
 * the transition, which is the same choice every date library makes.
 */
export function zonedWallTimeToUtc(wallTime: string, timeZone: string): Date | null {
  const match = WALL_TIME_PATTERN.exec(wallTime.trim());
  if (match === null || !isValidTimeZone(timeZone)) return null;

  const [year, month, day, hour, minute] = match.slice(1).map(Number);

  if (hour > 23 || minute > 59) return null;

  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute);

  // `Date.UTC` rolls overflow forward rather than rejecting it, so 2026-02-30
  // would silently become March 2nd. Round-tripping catches that.
  const rolled = new Date(asIfUtc);
  if (rolled.getUTCMonth() !== month - 1 || rolled.getUTCDate() !== day) return null;

  const firstGuess = new Date(asIfUtc - zoneOffsetMs(rolled, timeZone));
  return new Date(asIfUtc - zoneOffsetMs(firstGuess, timeZone));
}

/**
 * The inverse: an instant → the wall time it reads as in a given zone, in the
 * `YYYY-MM-DDTHH:mm` form the date input expects.
 *
 * This is what re-populates the editor's date field on load, so it must be an
 * exact inverse of `zonedWallTimeToUtc` — otherwise merely opening the editor
 * and saving would drift the event's time.
 */
export function utcToZonedWallTime(instant: Date, timeZone: string): string | null {
  if (Number.isNaN(instant.getTime()) || !isValidTimeZone(timeZone)) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);

  const field = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";

  // `hourCycle: "h23"` still yields "24" for midnight in some ICU versions.
  const hour = field("hour") === "24" ? "00" : field("hour");

  return `${field("year")}-${field("month")}-${field("day")}T${hour}:${field("minute")}`;
}

/**
 * The organizer's most likely timezone, for pre-filling the field on a draft
 * that has none. A guess about the *form's default*, never about stored data —
 * an unset timezone stays unset until someone chooses one.
 */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Every zone this runtime knows, sorted, for the editor's timezone select.
 *
 * `current` is always included even when the runtime doesn't list it. Two ways
 * that happens, both real: the value is a legacy link name ("US/Eastern") that
 * `supportedValuesOf` omits while `DateTimeFormat` still accepts, or the draft
 * was saved by a browser with newer tzdata than the server rendering the page.
 * Either way, dropping it would silently reset a saved event's timezone the
 * first time its owner opened the editor.
 */
export function supportedTimeZones(current?: string | null): string[] {
  // Guarded rather than assumed: `supportedValuesOf` is recent enough that an
  // older browser reaching this page should get a usable field, not a crash.
  const supported =
    typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];

  const zones = new Set<string>(supported.length > 0 ? supported : ["UTC"]);

  if (current != null && current.length > 0 && isValidTimeZone(current)) {
    zones.add(current);
  }

  return [...zones].sort((a, b) => a.localeCompare(b));
}

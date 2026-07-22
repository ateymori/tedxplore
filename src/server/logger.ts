/**
 * Structured logging + the error-monitoring seam (task 10.4).
 *
 * Every log line is a single JSON object, because that is what a log drain or
 * an APM ingests without a custom parser — Vercel forwards stdout/stderr
 * verbatim, so the structure has to be in the payload, not in formatting. Each
 * line carries a stable `event` slug (grep/alert on it), a level, a timestamp,
 * and whatever context the caller passes.
 *
 * `captureException` is the **error-monitoring hook point**: the single place
 * an error tracker (Sentry, etc.) gets wired. Nothing else in the codebase
 * calls a monitoring SDK — services and route handlers call this — so adding
 * one provider is one edit here, and until then the exception is still
 * captured, just to the structured log. Keeping it a named function (rather
 * than scattered `console.error(e)`) is what makes that future wiring a
 * one-liner instead of an audit.
 *
 * Deliberately dependency-free and framework-agnostic: it is imported by
 * services that must stay runnable from a plain Node script (the verification
 * scripts) and by route handlers alike.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

interface SerializedError {
  name: string;
  message: string;
  stack?: string;
}

function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: "NonError", message: String(error) };
}

function emit(level: LogLevel, event: string, context?: LogContext): void {
  const line = JSON.stringify({
    level,
    event,
    time: new Date().toISOString(),
    ...context,
  });

  // Route by level so a log drain's severity filter works, and so `error`/`warn`
  // reach stderr where platforms expect them.
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  debug: (event: string, context?: LogContext) => emit("debug", event, context),
  info: (event: string, context?: LogContext) => emit("info", event, context),
  warn: (event: string, context?: LogContext) => emit("warn", event, context),
  error: (event: string, context?: LogContext) => emit("error", event, context),
};

/**
 * Report an exception to monitoring.
 *
 * The seam for an error tracker. Callers pass the error plus a small context
 * object naming where it happened (`{ scope: "publish-notifications", … }`) so
 * an alert is actionable without a stack dive.
 */
export function captureException(error: unknown, context?: LogContext): void {
  emit("error", "exception", { ...context, error: serializeError(error) });
  // TODO(monitoring): forward to an error-tracking provider here — this is the
  // one place it needs wiring (e.g. Sentry.captureException(error, { extra })).
}

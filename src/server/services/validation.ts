import type { z } from "zod";

import { err, type Result } from "@/server/services/result";

/**
 * Zod → `VALIDATION_FAILED`.
 *
 * One conversion, used by every service, so the issue shape a form receives is
 * the same everywhere: field path → messages, with issues that have no path
 * (schema-level refinements) collected under `_form`.
 *
 * Dotted paths (`speakers.0.name`) are kept as-is — that is the key
 * React Hook Form's `setError` expects, so a server-side issue can be attached
 * to the exact input that produced it.
 */
export const FORM_LEVEL_ISSUE_KEY = "_form";

export function toIssues(error: z.ZodError): Record<string, string[]> {
  const issues: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : FORM_LEVEL_ISSUE_KEY;
    (issues[key] ??= []).push(issue.message);
  }

  return issues;
}

/**
 * Parses input at a service boundary.
 *
 * Services take `unknown` — their callers are Server Actions and route
 * handlers receiving client data — so parsing is the first thing every one of
 * them does. Returning a `Result` rather than throwing keeps invalid input an
 * ordinary outcome, which is what it is.
 */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): Result<z.infer<T>> {
  const parsed = schema.safeParse(input);

  return parsed.success
    ? { ok: true, value: parsed.data }
    : err({ type: "VALIDATION_FAILED", issues: toIssues(parsed.error) });
}

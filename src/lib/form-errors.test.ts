import { describe, expect, it } from "vitest";

import { domainErrorMessage, domainErrorToFormErrors, ROOT_ERROR_FIELD } from "@/lib/form-errors";
import type { DomainError } from "@/server/services/result";
import { FORM_LEVEL_ISSUE_KEY } from "@/server/services/validation";

describe("domainErrorToFormErrors", () => {
  it("attaches validation issues to their own fields", () => {
    expect(
      domainErrorToFormErrors({
        type: "VALIDATION_FAILED",
        issues: { slug: ["Too short."], displayName: ["No digits."] },
      }),
    ).toEqual([
      { field: "slug", message: "Too short." },
      { field: "displayName", message: "No digits." },
    ]);
  });

  it("expands a field carrying several issues into one entry each", () => {
    expect(
      domainErrorToFormErrors({
        type: "VALIDATION_FAILED",
        issues: { slug: ["Too short.", "Reserved."] },
      }),
    ).toHaveLength(2);
  });

  it("routes schema-level issues to the form rather than a phantom field", () => {
    expect(
      domainErrorToFormErrors({
        type: "VALIDATION_FAILED",
        issues: { [FORM_LEVEL_ISSUE_KEY]: ["Something is off."] },
      }),
    ).toEqual([{ field: ROOT_ERROR_FIELD, message: "Something is off." }]);
  });

  it.each<DomainError>([
    { type: "SLUG_TAKEN" },
    { type: "SLUG_RESERVED" },
    { type: "SLUG_LOCKED" },
  ])("puts $type on the slug field, where the user can act on it", (error) => {
    expect(domainErrorToFormErrors(error)[0]?.field).toBe("slug");
  });

  // Every remaining variant, listed explicitly: the mapping's `switch` is
  // exhaustive, so a new DomainError breaks the build — this makes sure the
  // message it gets is also actually reachable and non-empty.
  it.each<DomainError>([
    { type: "NOT_FOUND", resource: "event" },
    { type: "FORBIDDEN" },
    { type: "UNAUTHENTICATED" },
    { type: "LIMIT_EXCEEDED", limit: 16, resource: "speakers" },
    { type: "PENDING_REQUEST_EXISTS" },
    {
      type: "INCOMPLETE_CONTENT",
      issues: [{ field: "venueName", section: "venue", message: "Add the venue name." }],
    },
    { type: "INVALID_STATE", current: "PUBLISHED", attempted: "publish" },
    { type: "STALE_WRITE", updatedAt: new Date() },
    { type: "RATE_LIMITED", retryAfterMs: 1000 },
  ])("gives $type a form-level message", (error) => {
    const [first] = domainErrorToFormErrors(error);

    expect(first?.field).toBe(ROOT_ERROR_FIELD);
    expect(first?.message.length).toBeGreaterThan(0);
  });

  it("interpolates the specifics a user needs to act", () => {
    expect(
      domainErrorMessage({ type: "LIMIT_EXCEEDED", limit: 16, resource: "speakers" }),
    ).toContain("16");
  });

  // FR-30 asks for a *list* of what's missing, so this one variant maps to one
  // error per issue rather than collapsing to a single sentence.
  it("gives INCOMPLETE_CONTENT one message per missing requirement", () => {
    const errors = domainErrorToFormErrors({
      type: "INCOMPLETE_CONTENT",
      issues: [
        { field: "venueName", section: "venue", message: "Add the venue name." },
        { field: "eventDate", section: "schedule", message: "Set your event date and time." },
      ],
    });

    expect(errors).toHaveLength(2);
    expect(errors.map((error) => error.message)).toEqual([
      "Add the venue name.",
      "Set your event date and time.",
    ]);
  });
});

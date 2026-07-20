import { describe, expect, it } from "vitest";

import { SLUG_MAX_LENGTH, SLUG_MIN_LENGTH } from "@/config/limits";

import { isValidSlug, slugSchema } from "./slug";

function errorsFor(value: string): string[] {
  const result = slugSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("slugSchema", () => {
  it("accepts a lowercase a–z slug", () => {
    expect(isValidSlug("mcgillu")).toBe(true);
    expect(slugSchema.parse("mcgillu")).toBe("mcgillu");
  });

  it("trims surrounding whitespace before validating", () => {
    expect(slugSchema.parse("  mcgillu  ")).toBe("mcgillu");
  });

  it.each([
    ["uppercase", "McGillU"],
    ["digits", "tedx2025"],
    ["hyphens", "mcgill-u"],
    ["inner spaces", "mcgill u"],
    ["underscores", "mcgill_u"],
    ["accented letters", "montréal"],
    ["emoji", "mcgill🎤"],
  ])("rejects %s", (_label, value) => {
    expect(isValidSlug(value)).toBe(false);
  });

  it("enforces the configured length bounds", () => {
    expect(isValidSlug("a".repeat(SLUG_MIN_LENGTH - 1))).toBe(false);
    expect(isValidSlug("a".repeat(SLUG_MIN_LENGTH))).toBe(true);
    expect(isValidSlug("a".repeat(SLUG_MAX_LENGTH))).toBe(true);
    expect(isValidSlug("a".repeat(SLUG_MAX_LENGTH + 1))).toBe(false);
  });

  it("rejects the empty string", () => {
    expect(isValidSlug("")).toBe(false);
  });

  it("rejects reserved slugs from the central blocklist (BR-4)", () => {
    expect(isValidSlug("admin")).toBe(false);
    expect(isValidSlug("plore")).toBe(false);
    expect(isValidSlug("dashboard")).toBe(false);
  });

  it("reports the charset problem, not a length problem, for mixed input", () => {
    // "TEDx-2025" is 9 chars — long enough — so the only complaint should be
    // about the characters themselves.
    expect(errorsFor("TEDx-2025")).toEqual([expect.stringContaining("lowercase letters")]);
  });
});

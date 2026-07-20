import { describe, expect, it } from "vitest";

import { DISPLAY_NAME_MAX_LENGTH } from "@/config/limits";

import {
  displayNameSchema,
  isValidDisplayName,
  suggestDisplayName,
} from "./display-name";

describe("displayNameSchema", () => {
  it("accepts a typical TEDx display name", () => {
    expect(displayNameSchema.parse("TEDxMcGill University")).toBe(
      "TEDxMcGill University",
    );
  });

  it.each([
    ["accented letters", "TEDxMontréal"],
    ["hyphens", "TEDxSaint-Étienne"],
    ["non-Latin scripts", "TEDxتهران"],
    ["CJK characters", "TEDx東京"],
    ["Cyrillic", "TEDxМосква"],
    ["multiple words", "TEDx University of British Columbia"],
  ])("accepts %s", (_label, value) => {
    expect(isValidDisplayName(value)).toBe(true);
  });

  it("accepts a decomposed accent and normalizes it to NFC", () => {
    // Escapes, not literals: these two spellings must differ byte-for-byte
    // for the test to mean anything, and that is not something a test should
    // leave up to source-file encoding.
    const decomposed = "TEDxMontre\u0301al"; // e + combining acute
    const precomposed = "TEDxMontr\u00E9al"; // e-acute as one code point

    expect(decomposed).not.toBe(precomposed);
    // Both spellings must land on the same stored value — the whole point of
    // normalizing on the way in.
    expect(displayNameSchema.parse(decomposed)).toBe(precomposed);
    expect(displayNameSchema.parse(precomposed)).toBe(precomposed);
  });

  it("trims surrounding whitespace", () => {
    expect(displayNameSchema.parse("  TEDxMcGill  ")).toBe("TEDxMcGill");
  });

  it("rejects blank and whitespace-only names (FR-15a)", () => {
    expect(isValidDisplayName("")).toBe(false);
    expect(isValidDisplayName("   ")).toBe(false);
  });

  it("rejects digits with a specific message (BR-5b)", () => {
    const result = displayNameSchema.safeParse("TEDxMcGill 2025");

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toContainEqual(
      expect.stringContaining("can't contain numbers"),
    );
  });

  it.each([
    ["ampersands", "TEDxArts & Sciences"],
    ["apostrophes", "TEDxSt. John's"],
    ["slashes", "TEDxMcGill/Concordia"],
  ])("rejects %s (BR-5b allows letters, spaces, and hyphens only)", (_l, value) => {
    expect(isValidDisplayName(value)).toBe(false);
  });

  it("enforces the configured max length", () => {
    expect(isValidDisplayName("a".repeat(DISPLAY_NAME_MAX_LENGTH))).toBe(true);
    expect(isValidDisplayName("a".repeat(DISPLAY_NAME_MAX_LENGTH + 1))).toBe(false);
  });

  it("does not require uniqueness — the same name validates twice", () => {
    expect(isValidDisplayName("TEDxMcGill University")).toBe(true);
    expect(isValidDisplayName("TEDxMcGill University")).toBe(true);
  });
});

describe("suggestDisplayName", () => {
  it("prefixes TEDx and capitalizes the slug's first letter (BR-5c)", () => {
    expect(suggestDisplayName("mcgillu")).toBe("TEDxMcgillu");
    expect(suggestDisplayName("ab")).toBe("TEDxAb");
  });

  it("returns an empty string for an empty slug so the form stays blank", () => {
    expect(suggestDisplayName("")).toBe("");
    expect(suggestDisplayName("   ")).toBe("");
  });

  it("produces a value that itself passes display-name validation", () => {
    expect(isValidDisplayName(suggestDisplayName("mcgillu"))).toBe(true);
  });
});

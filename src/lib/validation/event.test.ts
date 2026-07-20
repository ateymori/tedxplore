import { describe, expect, it } from "vitest";

import { LICENSE_HOLDER_NAME_MAX_LENGTH } from "@/config/limits";
import { createEventSchema, eventSettingsSchema } from "@/lib/validation/event";
import { DEFAULT_TEMPLATE_ID } from "@/templates/registry";

const valid = {
  slug: "aurorabay",
  displayName: "TEDxAurora Bay",
  templateId: DEFAULT_TEMPLATE_ID,
  tedEventUrl: "https://www.ted.com/tedx/events/12345",
  licenseHolderName: "Priya Raman",
  authorizationConfirmed: true,
};

/** The field(s) a parse failed on, so assertions read as intent not structure. */
function failedFields(input: unknown): string[] {
  const result = createEventSchema.safeParse(input);
  if (result.success) return [];
  return [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
}

describe("createEventSchema", () => {
  it("accepts a complete, valid submission", () => {
    expect(createEventSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an unchecked authorization box (FR-8)", () => {
    expect(failedFields({ ...valid, authorizationConfirmed: false })).toEqual([
      "authorizationConfirmed",
    ]);
  });

  it("rejects an unknown template id", () => {
    expect(failedFields({ ...valid, templateId: "not-a-template" })).toEqual(["templateId"]);
  });

  it.each([
    ["uppercase", "AuroraBay"],
    ["digits", "aurora2026"],
    ["hyphens", "aurora-bay"],
    ["spaces", "aurora bay"],
    ["too short", "a"],
    ["reserved", "admin"],
  ])("rejects a slug with %s (BR-1, BR-4)", (_label, slug) => {
    expect(failedFields({ ...valid, slug })).toEqual(["slug"]);
  });

  it("rejects a display name containing digits (BR-5b)", () => {
    expect(failedFields({ ...valid, displayName: "TEDxAurora 2026" })).toEqual(["displayName"]);
  });

  it("accepts an accented display name (BR-5b)", () => {
    expect(createEventSchema.safeParse({ ...valid, displayName: "TEDxMontréal" }).success).toBe(
      true,
    );
  });

  it.each([
    ["a non-http scheme", "javascript:alert(1)"],
    ["a bare hostname", "ted.com/tedx/events/1"],
    ["an empty value", ""],
  ])("rejects a TED event URL that is %s (BR-12)", (_label, tedEventUrl) => {
    expect(failedFields({ ...valid, tedEventUrl })).toEqual(["tedEventUrl"]);
  });

  it("rejects a blank licence holder", () => {
    expect(failedFields({ ...valid, licenseHolderName: "   " })).toEqual(["licenseHolderName"]);
  });

  it("rejects an over-long licence holder", () => {
    expect(
      failedFields({ ...valid, licenseHolderName: "a".repeat(LICENSE_HOLDER_NAME_MAX_LENGTH + 1) }),
    ).toEqual(["licenseHolderName"]);
  });

  it("reports every invalid field at once, not just the first", () => {
    expect(failedFields({ ...valid, slug: "BAD-1", displayName: "TEDx 2026" }).sort()).toEqual([
      "displayName",
      "slug",
    ]);
  });

  it("trims surrounding whitespace", () => {
    const parsed = createEventSchema.parse({
      ...valid,
      slug: "  aurorabay  ",
      licenseHolderName: "  Priya Raman  ",
    });

    expect(parsed.slug).toBe("aurorabay");
    expect(parsed.licenseHolderName).toBe("Priya Raman");
  });
});

describe("eventSettingsSchema", () => {
  it("has no slug field — the address follows different rules (BR-5)", () => {
    const parsed = eventSettingsSchema.parse({
      displayName: "TEDxAurora Bay",
      tedEventUrl: "https://www.ted.com/tedx/events/12345",
      licenseHolderName: "Priya Raman",
      slug: "somethingelse",
    });

    expect(parsed).not.toHaveProperty("slug");
  });

  it("still requires a non-blank display name (FR-15a)", () => {
    const result = eventSettingsSchema.safeParse({
      displayName: "  ",
      tedEventUrl: "https://www.ted.com/tedx/events/12345",
      licenseHolderName: "Priya Raman",
    });

    expect(result.success).toBe(false);
  });
});

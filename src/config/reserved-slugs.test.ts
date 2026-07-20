import { describe, expect, it } from "vitest";
import { isReservedSlug } from "./reserved-slugs";

describe("isReservedSlug", () => {
  it("rejects known reserved words case-insensitively", () => {
    expect(isReservedSlug("admin")).toBe(true);
    expect(isReservedSlug("ADMIN")).toBe(true);
    expect(isReservedSlug("plore")).toBe(true);
  });

  it("allows an ordinary slug", () => {
    expect(isReservedSlug("mcgillu")).toBe(false);
  });
});

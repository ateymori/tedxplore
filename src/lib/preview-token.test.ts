import { describe, expect, it } from "vitest";

import { PREVIEW_TOKEN_BYTES } from "@/config/limits";
import { PREVIEW_TOKEN_LENGTH, generatePreviewToken, isPreviewTokenShaped } from "./preview-token";

/**
 * These tests pin the *strength* of the token, not its formatting. A change
 * that quietly shortened it or narrowed its alphabet would still produce
 * working links, so nothing else in the system would notice.
 */

describe("generatePreviewToken", () => {
  it("carries the full 256 bits of entropy", () => {
    expect(PREVIEW_TOKEN_BYTES * 8).toBeGreaterThanOrEqual(256);
    // base64url is a pure re-encoding, so decoding must return every byte.
    expect(Buffer.from(generatePreviewToken(), "base64url")).toHaveLength(PREVIEW_TOKEN_BYTES);
  });

  it("is URL-safe: no padding, no slashes, no plus signs", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generatePreviewToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 500 }, generatePreviewToken));
    expect(seen.size).toBe(500);
  });

  it("always produces the declared length", () => {
    expect(PREVIEW_TOKEN_LENGTH).toBe(43);
    expect(generatePreviewToken()).toHaveLength(PREVIEW_TOKEN_LENGTH);
  });
});

describe("isPreviewTokenShaped", () => {
  it("accepts what the generator produces", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(isPreviewTokenShaped(generatePreviewToken())).toBe(true);
    }
  });

  it.each([
    ["empty", ""],
    ["too short", "a".repeat(PREVIEW_TOKEN_LENGTH - 1)],
    ["too long", "a".repeat(PREVIEW_TOKEN_LENGTH + 1)],
    ["standard base64 padding", `${"a".repeat(PREVIEW_TOKEN_LENGTH - 1)}=`],
    ["a path traversal", "../".padEnd(PREVIEW_TOKEN_LENGTH, "a")],
    ["a slug", "draft"],
  ])("rejects %s", (_label, value) => {
    expect(isPreviewTokenShaped(value)).toBe(false);
  });
});

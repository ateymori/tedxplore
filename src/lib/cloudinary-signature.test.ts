import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { signParams } from "./cloudinary-signature";

/**
 * These tests pin the algorithm, not a stored digest, because the failure mode
 * they guard against is silent: a signature that is merely *different* is
 * rejected by Cloudinary with a 401, and every upload in the product stops
 * working at once. Verified against the live API during Phase 5 — this suite is
 * what keeps it working without an account or a network.
 */

const SECRET = "test-secret";

/** The rule, restated independently of the implementation. */
function expected(params: Record<string, string | number>, secret: string): string {
  const canonical = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(`${canonical}${secret}`).digest("hex");
}

describe("signParams", () => {
  it("produces a 40-character hex SHA-1", () => {
    expect(signParams({ timestamp: 1 }, SECRET)).toMatch(/^[0-9a-f]{40}$/);
  });

  it("sorts parameters by key, so declaration order is irrelevant", () => {
    const a = signParams({ folder: "x", public_id: "y", timestamp: 3 }, SECRET);
    const b = signParams({ timestamp: 3, public_id: "y", folder: "x" }, SECRET);

    expect(a).toBe(b);
    expect(a).toBe(expected({ folder: "x", public_id: "y", timestamp: 3 }, SECRET));
  });

  it("changes when any signed value changes", () => {
    const base = signParams({ folder: "events/a", timestamp: 100 }, SECRET);

    // Each of these is a tamper attempt the live API rejected with a 401.
    expect(signParams({ folder: "events/b", timestamp: 100 }, SECRET)).not.toBe(base);
    expect(signParams({ folder: "events/a", timestamp: 101 }, SECRET)).not.toBe(base);
    expect(signParams({ folder: "events/a", timestamp: 100, overwrite: "true" }, SECRET)).not.toBe(
      base,
    );
  });

  it("changes when the secret changes", () => {
    const params = { folder: "events/a", timestamp: 100 };
    expect(signParams(params, "one")).not.toBe(signParams(params, "two"));
  });

  it("stringifies numbers the way Cloudinary expects", () => {
    // `timestamp=100`, never `timestamp=100.0` or a quoted form.
    expect(signParams({ timestamp: 100 }, SECRET)).toBe(signParams({ timestamp: "100" }, SECRET));
  });

  it("handles the exact parameter set the upload ticket signs", () => {
    const params = {
      folder: "tedxplore/events/abc123",
      public_id: "hero-1f2e3d",
      overwrite: "false",
      timestamp: 1784595499,
    };

    expect(signParams(params, SECRET)).toBe(expected(params, SECRET));
  });

  it("treats an empty parameter set as just the secret", () => {
    expect(signParams({}, SECRET)).toBe(createHash("sha1").update(SECRET).digest("hex"));
  });
});

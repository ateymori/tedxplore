import { describe, expect, it } from "vitest";
import { isAdminPath, isAuthPath, isProtectedPath } from "@/config/routes";

describe("isProtectedPath", () => {
  it("matches the prefix itself and anything below it", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/dashboard/events/abc")).toBe(true);
    expect(isProtectedPath("/admin")).toBe(true);
  });

  it("does not match public routes", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
    // Public event sites are `/tedx{slug}` and are never gated.
    expect(isProtectedPath("/tedxmcgillu")).toBe(false);
  });

  it("only matches on a segment boundary", () => {
    // The dangerous direction: a slug-shaped path that merely starts with the
    // same letters must not be treated as protected — or as unprotected.
    expect(isProtectedPath("/dashboards")).toBe(false);
    expect(isProtectedPath("/administration")).toBe(false);
    expect(isProtectedPath("/admin-tools")).toBe(false);
  });
});

describe("isAdminPath", () => {
  it("covers only the admin area", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/events")).toBe(true);
    expect(isAdminPath("/dashboard")).toBe(false);
    expect(isAdminPath("/administration")).toBe(false);
  });
});

describe("isAuthPath", () => {
  it("covers the pages a signed-in user should be redirected away from", () => {
    expect(isAuthPath("/login")).toBe(true);
    expect(isAuthPath("/signup")).toBe(true);
    expect(isAuthPath("/forgot-password")).toBe(true);
    expect(isAuthPath("/reset-password")).toBe(true);
  });

  it("excludes verify-email, which an unverified user must still reach", () => {
    expect(isAuthPath("/verify-email")).toBe(false);
  });
});

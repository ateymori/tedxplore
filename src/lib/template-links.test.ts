import { describe, expect, it } from "vitest";

import { NEW_EVENT_PATH, LOGIN_PATH, RETURN_TO_PARAM, TEMPLATE_PARAM } from "@/config/routes";
import { sanitizeReturnTo } from "@/lib/return-to";
import { templateEditHref } from "@/lib/template-links";
import { DEFAULT_TEMPLATE_ID } from "@/templates/registry";

/**
 * FR-51's handoff, which is the one piece of the homepage that is a *rule*
 * rather than a layout: an unauthenticated visitor who picks a template must
 * come back to that template's create-event form after signing in, not to the
 * dashboard.
 */
describe("templateEditHref", () => {
  it("sends an authenticated visitor straight to event creation", () => {
    expect(templateEditHref("aurora", true)).toBe(`${NEW_EVENT_PATH}?${TEMPLATE_PARAM}=aurora`);
  });

  it("sends an unauthenticated visitor to login first", () => {
    expect(templateEditHref("aurora", false).startsWith(LOGIN_PATH)).toBe(true);
  });

  it("carries the chosen template through login and back", () => {
    const url = new URL(templateEditHref("aurora", false), "https://tedxplore.com");
    const returnTo = url.searchParams.get(RETURN_TO_PARAM);

    // The round trip, asserted end to end: what login will redirect to is
    // exactly what the signed-in button would have opened.
    expect(returnTo).toBe(templateEditHref("aurora", true));
    expect(returnTo).toContain(`${TEMPLATE_PARAM}=aurora`);
  });

  it("produces a returnTo the login page will actually accept", () => {
    // `loginPathWithReturnTo` sanitizes on the way in and the login page
    // sanitizes again on the way out; a value that failed the second check
    // would silently dump the visitor on the dashboard.
    const url = new URL(templateEditHref("aurora", false), "https://tedxplore.com");

    expect(sanitizeReturnTo(url.searchParams.get(RETURN_TO_PARAM))).not.toBeNull();
  });

  it("escapes a template id rather than letting it forge query parameters", () => {
    const url = new URL(templateEditHref("a&role=admin", false), "https://tedxplore.com");
    const returnTo = new URL(url.searchParams.get(RETURN_TO_PARAM) ?? "", "https://tedxplore.com");

    expect(returnTo.searchParams.get(TEMPLATE_PARAM)).toBe("a&role=admin");
    expect(returnTo.searchParams.get("role")).toBeNull();
  });

  it("works for every registered template, not just aurora", () => {
    expect(templateEditHref(DEFAULT_TEMPLATE_ID, true)).toContain(
      `${TEMPLATE_PARAM}=${DEFAULT_TEMPLATE_ID}`,
    );
  });
});

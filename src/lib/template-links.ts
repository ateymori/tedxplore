import { newEventPath } from "@/config/routes";

import { loginPathWithReturnTo } from "./return-to";

/**
 * Where a template card's **Edit** button goes (FR-51).
 *
 * Signed in, it goes straight to event creation for that template. Signed out,
 * it goes to login carrying a `returnTo` that points at the *same* destination
 * — so authenticating drops the visitor into the create-event form for the
 * template they picked, rather than at the dashboard wondering what happened to
 * their choice.
 *
 * Its own module rather than a helper in `config/routes.ts` because the
 * signed-out branch needs `sanitizeReturnTo`, and `return-to.ts` already
 * imports the route constants — putting this there would close the cycle.
 *
 * A pure function of two inputs, which is what lets the rule be tested without
 * a browser, a session, or a rendered page.
 */
export function templateEditHref(templateId: string, isAuthenticated: boolean): string {
  const destination = newEventPath(templateId);

  return isAuthenticated ? destination : loginPathWithReturnTo(destination);
}

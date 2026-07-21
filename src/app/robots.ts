import type { MetadataRoute } from "next";

import {
  ADMIN_PATH,
  DASHBOARD_PATH,
  FORGOT_PASSWORD_PATH,
  LOGIN_PATH,
  PREVIEW_PATH_PREFIX,
  RESET_PASSWORD_PATH,
  SIGNUP_PATH,
  VERIFY_EMAIL_PATH,
} from "@/config/routes";
import { APP_URL } from "@/config/site";

/**
 * Crawl rules (task 8.2).
 *
 * The public surface is the marketing homepage and the live event sites; the
 * disallow list is everything else. Paths come from `config/routes.ts` rather
 * than being retyped here, so a renamed route cannot silently become
 * crawlable.
 *
 * Two notes on what this is and isn't:
 *
 *   - **`robots.txt` is a request, not a control.** Everything listed below is
 *     independently protected — the dashboard and admin area by session guards
 *     (`server/auth-guards.ts`), preview links by an unguessable 256-bit token
 *     plus `noindex` on the page *and* an `X-Robots-Tag` header from
 *     `next.config.ts`. This file only stops well-behaved crawlers wasting
 *     their budget and surfacing login pages in results.
 *   - **Disallowing a path does not remove it from an index.** That is what
 *     the `noindex` signals are for, which is why `/preview` carries both.
 *
 * The template Live Preview is disallowed deliberately: it renders demo content
 * through the real template, so it is a complete-looking TEDx event site for
 * an event that does not exist. Indexed, it would compete with — and be
 * mistaken for — the organizers' actual sites. It stays fully public and
 * linkable for humans (FR-50); it just should not be in a search index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        `${DASHBOARD_PATH}/`,
        `${ADMIN_PATH}/`,
        `${PREVIEW_PATH_PREFIX}/`,
        "/api/",
        "/templates/",
        LOGIN_PATH,
        SIGNUP_PATH,
        VERIFY_EMAIL_PATH,
        FORGOT_PASSWORD_PATH,
        RESET_PASSWORD_PATH,
      ],
    },
    sitemap: new URL("/sitemap.xml", APP_URL).toString(),
  };
}

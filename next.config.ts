import type { NextConfig } from "next";

import { PREVIEW_PATH_PREFIX } from "./src/config/routes";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content Security Policy (task 10.2).
 *
 * Nonce-free, and that is a deliberate architectural consequence rather than a
 * shortcut. Next.js can only inject a per-request nonce into its inline
 * hydration scripts when the page is *dynamically* rendered — and a nonce-based
 * CSP therefore disables static optimization, ISR, and Partial Prerendering
 * (confirmed in the Next.js CSP guide). Our public event sites are the whole
 * reason Phase 8 exists: statically prerendered `use cache` pages behind PPR,
 * hitting Lighthouse ≥ 90. Forcing every one of them dynamic to carry a nonce
 * would trade the product's core performance guarantee for a hardening we can
 * get most of another way.
 *
 * So `script-src` allows `'unsafe-inline'`, which is safe *here* specifically
 * because the injection surface is closed by construction: there is no
 * `dangerouslySetInnerHTML` anywhere in the codebase (audited), React escapes
 * every piece of organizer-authored text to a text node, and templates render
 * user URLs only through validated `http(s)` `href`/`src` attributes. The CSP
 * is defence-in-depth on top of that, not the only wall.
 *
 * The rest of the policy is tight: no plugins (`object-src 'none'`), no framing
 * of our pages (`frame-ancestors 'none'`), no `<base>` hijacking, forms may
 * only post same-origin. The two external hosts are Cloudinary's — delivery
 * (`res.cloudinary.com`, images) and the direct-upload API
 * (`api.cloudinary.com`, an editor `fetch`).
 *
 * Development needs two extra allowances the production policy must not carry:
 * `'unsafe-eval'` (React Refresh / HMR) and the Turbopack HMR WebSocket. And
 * `upgrade-insecure-requests` is production-only — on `http://localhost` it
 * would upgrade every dev asset to a non-existent https origin.
 */
function contentSecurityPolicy(): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https://res.cloudinary.com data: blob:",
    "font-src 'self'",
    `connect-src 'self' https://api.cloudinary.com${isDev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];

  return directives.join("; ");
}

/**
 * Security headers applied to every response (task 10.2).
 *
 * `frame-ancestors 'none'` in the CSP is the modern anti-clickjacking control;
 * `X-Frame-Options: DENY` is kept alongside it for older agents. HSTS is
 * production-only — it is meaningless (and ignored) over plain-http localhost,
 * and committing a long max-age against a dev origin is a foot-gun.
 */
function securityHeaders() {
  const headers = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy() },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    },
  ];

  if (!isDev) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    });
  }

  return headers;
}

const nextConfig: NextConfig = {
  cacheComponents: true,

  async headers() {
    return [
      {
        // Every route — pages, API, and the public event sites — gets the
        // baseline security headers and the CSP.
        source: "/:path*",
        headers: securityHeaders(),
      },
      {
        /**
         * FR-27: no preview response may be indexed — neither the owner's
         * (`/preview/draft/…`) nor a tokenized link (`/preview/[token]`).
         *
         * The pages also set the `robots` meta tag, and the duplication is
         * deliberate: the header reaches crawlers that never parse the HTML,
         * and it survives a page that forgets its metadata. Anchored to the
         * prefix constant so a route rename cannot leave the rule behind.
         */
        source: `${PREVIEW_PATH_PREFIX}/:path*`,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;

/**
 * Reading the client address from proxy headers.
 *
 * Pure, and deliberately separate from `server/adapters/rate-limit.ts` — the
 * same split as `lib/cloudinary-url.ts` against the Cloudinary adapter. This
 * has no secret, no database, and no `server-only` guard, which is what makes
 * it unit-testable; the header-parsing rule below is a security detail worth
 * pinning with tests rather than reasoning about once.
 */

/**
 * The client's address, or `null` when it cannot be determined.
 *
 * `x-forwarded-for` is a list appended to by each proxy in the chain, so the
 * **first** entry is the original client and later ones are the hops. Reading
 * the last entry instead would rate-limit our own proxy — one bucket for all
 * traffic — which is a total failure that still looks like it works.
 *
 * Trusting a client-supplied header at all is only safe because the hosting
 * platform overwrites it at the edge. A caller running without a proxy in
 * front (local dev, or a misconfigured deployment) gets whatever the client
 * claims, which is why nothing security-critical may depend on this value
 * being honest — it bounds abuse, it does not authenticate anyone.
 *
 * `null` deliberately does not fall back to a constant. A shared sentinel
 * would put every anonymous visitor in one rate-limit bucket, letting a single
 * actor exhaust the limit for the entire world.
 */
export function clientIpFrom(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded !== null) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  // Vercel sets this; other platforms vary. Checked second because
  // `x-forwarded-for` is the standard and carries the full chain.
  const real = headers.get("x-real-ip")?.trim();
  return real ? real : null;
}

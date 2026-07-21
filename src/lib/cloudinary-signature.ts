import { createHash } from "node:crypto";

/**
 * Cloudinary's upload signature.
 *
 * Pure, and deliberately separate from `server/adapters/cloudinary.ts` for the
 * same reason `cloudinary-url.ts` is: that module holds secrets, reads
 * environment, and does I/O, none of which this needs. The secret arrives as an
 * argument, so this function can be unit-tested exhaustively without a
 * Cloudinary account, an env file, or a network — which matters, because a
 * silent change here means every upload starts failing with a 401.
 *
 * The algorithm: take the parameters to be signed, sort by key, join as `k=v`
 * with `&`, append the API secret, SHA-1, hex.
 *
 * `file`, `api_key`, and `resource_type` are excluded by Cloudinary's rules.
 * They travel with the request but are not part of the signed string; including
 * one produces a signature Cloudinary computes differently, and the upload is
 * rejected.
 */
export function signParams(params: Record<string, string | number>, apiSecret: string): string {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return createHash("sha1").update(`${canonical}${apiSecret}`).digest("hex");
}

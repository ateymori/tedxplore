import "server-only";
import { isCloudinaryConfigured, serverEnv } from "@/config/env";
import { signParams } from "@/lib/cloudinary-signature";

/**
 * Cloudinary, behind an adapter (architectural invariant 4).
 *
 * No SDK. Everything this project needs from Cloudinary is three HTTP calls and
 * a SHA-1, and the official package pulls in a large dependency tree to wrap
 * them — the same trade already made for date handling in `lib/datetime.ts`.
 * Keeping it hand-rolled also means the signing algorithm is visible in the one
 * place where getting it wrong matters.
 *
 * ## Why uploads go browser → Cloudinary, not browser → us → Cloudinary
 *
 * A 10 MB image (FR-21's ceiling) proxied through a Server Action would occupy
 * a serverless function for the whole transfer and count against its request
 * body limit. Instead the server signs a *constrained* set of parameters and
 * the browser posts the file straight to Cloudinary. Our server sees only the
 * signature request and the confirmation, both tiny.
 *
 * ## What stops a client uploading wherever it likes
 *
 * The signature covers the `folder` and `public_id`, both derived server-side
 * from the event id — Cloudinary rejects any upload whose parameters don't
 * match what was signed, so a tampered request fails at Cloudinary rather than
 * at us. The client still *reports* the result back, and that report is not
 * trusted: `fetchResource` re-reads the asset's real dimensions, format, and
 * byte size from the Admin API before anything is written to our database.
 */

const API_BASE = "https://api.cloudinary.com/v1_1";

/** Public by nature — it is in every delivery URL. Read here for the API host. */
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

export class CloudinaryNotConfiguredError extends Error {
  constructor() {
    super("Cloudinary is not configured");
    this.name = "CloudinaryNotConfiguredError";
  }
}

function credentials(): { apiKey: string; apiSecret: string; cloudName: string } {
  if (
    !isCloudinaryConfigured ||
    serverEnv.CLOUDINARY_API_KEY === undefined ||
    serverEnv.CLOUDINARY_API_SECRET === undefined
  ) {
    throw new CloudinaryNotConfiguredError();
  }

  return {
    apiKey: serverEnv.CLOUDINARY_API_KEY,
    apiSecret: serverEnv.CLOUDINARY_API_SECRET,
    cloudName: CLOUD_NAME,
  };
}

/**
 * Re-exported so callers have one Cloudinary entry point; the implementation
 * lives in `lib/cloudinary-signature.ts`, which is pure and unit-tested.
 */
export { signParams };

export interface UploadTicket {
  /** Where the browser posts the file. */
  url: string;
  /** The exact fields to send alongside it, signature included. */
  fields: Record<string, string>;
  /** The public id the upload will land on, so the caller can confirm it later. */
  publicId: string;
}

/**
 * Builds everything the browser needs for one signed upload.
 *
 * `publicId` is chosen here, not by the client, and is namespaced by event —
 * which is what makes a stolen ticket useless for overwriting another
 * organizer's assets, and what lets an orphan sweep (task 10.4) find every
 * asset belonging to a deleted event by prefix.
 *
 * `overwrite: false` plus a unique id means a replayed ticket cannot clobber an
 * existing asset; Cloudinary assigns a fresh name instead.
 */
export function createUploadTicket({
  folder,
  publicId,
  timestamp = Math.floor(Date.now() / 1000),
}: {
  folder: string;
  publicId: string;
  timestamp?: number;
}): UploadTicket {
  const { apiKey, apiSecret, cloudName } = credentials();

  // Every one of these is covered by the signature, so the browser can change
  // none of them without Cloudinary rejecting the upload.
  const signed: Record<string, string | number> = {
    folder,
    public_id: publicId,
    overwrite: "false",
    timestamp,
  };

  const signature = signParams(signed, apiSecret);

  return {
    url: `${API_BASE}/${cloudName}/image/upload`,
    fields: {
      ...Object.fromEntries(Object.entries(signed).map(([key, value]) => [key, String(value)])),
      api_key: apiKey,
      signature,
    },
    publicId: `${folder}/${publicId}`,
  };
}

export interface CloudinaryResource {
  publicId: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

/**
 * The authoritative record of an uploaded asset, read from Cloudinary itself.
 *
 * This is the trust boundary. The browser tells us an upload succeeded and what
 * it produced; believing that would let a client claim any public id (including
 * another event's) or lie about dimensions that templates use to reserve layout
 * space. Everything written to `MediaAsset` comes from this call instead.
 *
 * Returns `null` when the asset does not exist, which is the honest answer for
 * a client reporting an upload that never happened.
 */
export async function fetchResource(publicId: string): Promise<CloudinaryResource | null> {
  const { apiKey, apiSecret, cloudName } = credentials();

  const response = await fetch(
    `${API_BASE}/${cloudName}/resources/image/upload/${encodeURIComponent(publicId)}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
      },
      cache: "no-store",
    },
  );

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`Cloudinary resource lookup failed with ${response.status}`);
  }

  const body = (await response.json()) as {
    public_id: string;
    format: string;
    width: number;
    height: number;
    bytes: number;
  };

  return {
    publicId: body.public_id,
    format: body.format,
    width: body.width,
    height: body.height,
    bytes: body.bytes,
  };
}

/**
 * Deletes an asset.
 *
 * Used by the orphan sweep (task 10.4) and by hard event deletion. Deliberately
 * *not* called when an organizer merely swaps one image for another: snapshots
 * are immutable (invariant 3) and a published site may still be rendering the
 * old asset, so removing it from the draft must not remove it from Cloudinary.
 * That is exactly why `MediaAsset` rows outlive the fields that referenced them.
 */
export async function destroyResource(publicId: string): Promise<void> {
  const { apiKey, apiSecret, cloudName } = credentials();
  const timestamp = Math.floor(Date.now() / 1000);

  const signature = signParams({ public_id: publicId, timestamp }, apiSecret);

  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: apiKey,
    signature,
  });

  const response = await fetch(`${API_BASE}/${cloudName}/image/destroy`, {
    method: "POST",
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Cloudinary destroy failed with ${response.status}`);
  }
}

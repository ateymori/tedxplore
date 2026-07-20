/**
 * Cloudinary delivery-URL construction.
 *
 * Pure string building, deliberately separate from the upload adapter Phase 5.4
 * adds: templates are Server Components that must never import an SDK or a
 * secret, and they only ever need to *read* an image. `EventContent` carries
 * the public id and the intrinsic dimensions, which is everything a `<img>`
 * needs.
 *
 * Every rendition is transformed — the original upload is never served
 * directly (tech-stack decision on Cloudinary): `f_auto,q_auto` alone
 * typically halves the bytes, and an explicit width stops a 4000px hero from
 * being sent to a phone.
 */

/**
 * Public because it is baked into client-visible URLs anyway; there is nothing
 * secret about a cloud name. Unset in local development until Phase 5, which is
 * why every function here degrades to `null` rather than throwing — a missing
 * cloud name must never break a page that has no images.
 */
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? null;

export interface CloudinaryTransform {
  /** Target width in CSS pixels; Cloudinary caps upscaling with `c_limit`. */
  width: number;
  /** Omit to preserve the source aspect ratio. */
  height?: number;
  /** `fill` crops to the exact box; `limit` fits within it. */
  crop?: "fill" | "limit";
}

/**
 * Builds a delivery URL, or `null` when Cloudinary is not configured.
 *
 * Callers must handle `null` by rendering their no-image state — the same
 * branch an absent `ImageRef` takes — so a misconfigured deployment shows the
 * FR-38 fallback visual instead of a broken image icon.
 */
export function cloudinaryUrl(
  publicId: string,
  { width, height, crop = "limit" }: CloudinaryTransform,
): string | null {
  if (CLOUD_NAME === null) return null;

  const transforms = [
    `c_${crop}`,
    `w_${Math.round(width)}`,
    height === undefined ? null : `h_${Math.round(height)}`,
    // `g_auto` only matters when cropping, but Cloudinary ignores it otherwise.
    crop === "fill" ? "g_auto" : null,
    "f_auto",
    "q_auto",
    // Without this, a portrait phone photo carrying EXIF orientation renders
    // sideways in browsers that ignore the tag on a transformed asset.
    "a_ignore",
  ]
    .filter((part): part is string => part !== null)
    .join(",");

  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transforms}/${encodeURIComponent(publicId)}`;
}

export interface SrcSetOptions {
  crop?: "fill" | "limit";
  /**
   * Width ÷ height of the rendered box, for cropped images.
   *
   * Expressed as a ratio rather than a fixed height because every candidate in
   * a `srcset` is a different width: a constant height would make the crop
   * squarer at each step up, so the browser would swap between differently
   * *shaped* images as the viewport changed.
   */
  aspectRatio?: number;
}

/**
 * A `srcset` across a ladder of widths.
 *
 * Widths above the image's intrinsic width are dropped rather than requested:
 * Cloudinary would return the original size for them, and the browser would
 * treat the duplicate as a genuinely larger candidate and prefer it.
 */
export function cloudinarySrcSet(
  publicId: string,
  intrinsicWidth: number,
  widths: number[],
  { crop = "limit", aspectRatio }: SrcSetOptions = {},
): string | null {
  if (CLOUD_NAME === null) return null;

  const candidates = widths
    .filter((width) => width <= intrinsicWidth)
    .map((width) => {
      const url = cloudinaryUrl(publicId, {
        width,
        crop,
        height: aspectRatio === undefined ? undefined : Math.round(width / aspectRatio),
      });
      return url === null ? null : `${url} ${width}w`;
    })
    .filter((entry): entry is string => entry !== null);

  return candidates.length === 0 ? null : candidates.join(", ");
}

/** The width ladder Aurora's full-bleed and card images are served at. */
export const IMAGE_WIDTHS = [320, 480, 640, 828, 1080, 1280, 1600, 1920, 2560] as const;

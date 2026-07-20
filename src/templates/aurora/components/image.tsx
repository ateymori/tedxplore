import type { ImageRef } from "@/content/event-content";
import { IMAGE_WIDTHS, cloudinarySrcSet, cloudinaryUrl } from "@/lib/cloudinary-url";
import { cn } from "@/lib/utils";

/**
 * Aurora's image element.
 *
 * A plain `<img>` rather than `next/image`, on purpose: Cloudinary already
 * does format negotiation, quality selection, and resizing at the edge
 * (`f_auto,q_auto`), so routing the same asset through Next's optimizer would
 * add a second hop and a second cache for no gain. What `next/image` really
 * buys — intrinsic sizing to prevent layout shift — we get for free, because
 * `ImageRef` carries the dimensions (see `imageRefSchema`).
 *
 * `alt` is required and has no default. `EventContent` stores no alt text
 * (every slot has adjacent content that describes it better), so each call
 * site must derive it from the speaker, sponsor, or venue it belongs to, and a
 * decorative image must say so by passing `""` (NFR-3).
 */

export interface ResolvedImage {
  src: string;
  srcSet: string | null;
}

/**
 * `null` when there is no image *or* Cloudinary is unconfigured.
 *
 * Exported so a caller that needs a fallback — the Hero's default visual
 * (FR-38) — can branch before it lays anything out, instead of discovering
 * mid-render that `AuroraImage` rendered nothing.
 */
export function resolveImage(
  image: ImageRef | null,
  widths: readonly number[] = IMAGE_WIDTHS,
  options: { crop?: "fill" | "limit"; aspectRatio?: number } = {},
): ResolvedImage | null {
  if (image === null) return null;

  const largest = Math.min(image.width, Math.max(...widths));
  const src = cloudinaryUrl(image.cloudinaryPublicId, {
    width: largest,
    crop: options.crop,
    height:
      options.aspectRatio === undefined ? undefined : Math.round(largest / options.aspectRatio),
  });
  if (src === null) return null;

  return {
    src,
    srcSet: cloudinarySrcSet(image.cloudinaryPublicId, image.width, [...widths], options),
  };
}

interface AuroraImageProps {
  image: ImageRef;
  alt: string;
  /** The `sizes` attribute. Required — a wrong `sizes` silently ships the
   * largest candidate to every phone, which is the whole cost `srcset` exists
   * to avoid. */
  sizes: string;
  className?: string;
  crop?: "fill" | "limit";
  aspectRatio?: number;
  /**
   * Set on the hero image only. Above-the-fold images must not be lazy — the
   * browser would delay the request until layout, which is exactly the wrong
   * order for the Largest Contentful Paint element.
   */
  priority?: boolean;
}

export function AuroraImage({
  image,
  alt,
  sizes,
  className,
  crop = "limit",
  aspectRatio,
  priority = false,
}: AuroraImageProps) {
  const resolved = resolveImage(image, IMAGE_WIDTHS, { crop, aspectRatio });
  if (resolved === null) return null;

  const height = aspectRatio === undefined ? image.height : Math.round(image.width / aspectRatio);

  return (
    /* eslint-disable-next-line @next/next/no-img-element -- Cloudinary is the
       optimizer here; see the module comment. */
    <img
      src={resolved.src}
      srcSet={resolved.srcSet ?? undefined}
      sizes={sizes}
      alt={alt}
      width={image.width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding={priority ? "sync" : "async"}
      className={cn("block", className)}
    />
  );
}

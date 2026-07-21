import type { MediaKind } from "@/generated/prisma/enums";

/**
 * Image slot rules (FR-20..FR-23).
 *
 * Central, per invariant 5: the upload field, the server-side verification, and
 * the copy the user reads all derive from this file, so a change to what is
 * accepted cannot land in one place and not the others.
 */

/**
 * Formats we accept, as Cloudinary reports them.
 *
 * Checked against `fetchResource().format` *after* upload rather than against
 * the browser's `File.type` before it — a content type is client-supplied and
 * trivially wrong, while this is Cloudinary's own reading of the actual bytes.
 * The client-side check on `File.type` still exists, purely so the user finds
 * out before spending a 10 MB upload.
 */
export const ACCEPTED_IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp", "avif"] as const;

/**
 * SVG is rejected in V1, including for sponsor logos.
 *
 * FR-21 allows sponsor logos to be SVG "only if sanitization is feasible,
 * otherwise rejected", and this is the "otherwise". An SVG is a document that
 * can carry script and external references; sanitizing one properly is a real
 * piece of security work, not a config flag. The cost of saying no is close to
 * zero here — every rendition is served through a Cloudinary transform, which
 * rasterizes SVG anyway (FR-22), so an accepted SVG would reach visitors as a
 * PNG and buy nothing but the risk.
 *
 * `ACCEPTED_SPONSOR_LOGO_CONTENT_TYPES` in `limits.ts` is left in place for
 * whenever that work is actually done.
 */
export const SVG_ACCEPTED = false;

export function isAcceptedImageFormat(format: string): boolean {
  return (ACCEPTED_IMAGE_FORMATS as readonly string[]).includes(format.toLowerCase());
}

/**
 * Every asset for an event lives under one prefix.
 *
 * Two things depend on this: the upload signature constrains uploads to the
 * event's own folder, so a leaked ticket can't touch another organizer's
 * assets; and the orphan sweep (task 10.4) can enumerate a deleted event's
 * assets by prefix rather than by joining against rows that are already gone.
 */
export function eventMediaFolder(eventId: string): string {
  return `tedxplore/events/${eventId}`;
}

export interface ImageSlotSpec {
  /** What the field is called in the UI. */
  label: string;
  /** Guidance shown under the field — aspect ratio, what it's used for. */
  hint: string;
  /**
   * The shape the template renders this slot at, used to preview the crop and
   * to warn about very small uploads. Not enforced — Cloudinary crops on
   * delivery, and refusing a portrait photo for a landscape slot would be
   * hostile when the crop is automatic and good.
   */
  aspectRatio: number;
  /**
   * Below this width the image will look soft at the size it's rendered.
   * A warning, never a rejection.
   */
  recommendedMinWidth: number;
}

export const IMAGE_SLOTS: Record<MediaKind, ImageSlotSpec> = {
  HERO: {
    label: "Hero background",
    hint: "A wide, atmospheric image behind your event name. Optional — without one we show a designed gradient backdrop instead.",
    aspectRatio: 16 / 9,
    recommendedMinWidth: 1600,
  },
  VENUE: {
    label: "Venue photo",
    hint: "A photo of the space, shown beside your venue details.",
    aspectRatio: 4 / 3,
    recommendedMinWidth: 1000,
  },
  SPEAKER_PHOTO: {
    label: "Speaker photo",
    hint: "A portrait. Without one we show the speaker's initials.",
    aspectRatio: 1,
    recommendedMinWidth: 600,
  },
  TEAM_PHOTO: {
    label: "Photo",
    hint: "A portrait. Without one we show their initials.",
    aspectRatio: 1,
    recommendedMinWidth: 400,
  },
  SPONSOR_LOGO: {
    label: "Logo",
    hint: "Ideally with a transparent background (PNG or WebP).",
    aspectRatio: 3 / 2,
    recommendedMinWidth: 400,
  },
};

/** Human-readable accepted formats, for field descriptions and error copy. */
export const ACCEPTED_FORMATS_LABEL = "JPEG, PNG, WebP, or AVIF";

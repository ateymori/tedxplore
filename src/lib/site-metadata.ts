import type { EventContent } from "@/content/event-content";
import { cloudinaryUrl } from "@/lib/cloudinary-url";

/**
 * Search-engine and social-card metadata derived from `EventContent` (FR-47,
 * task 8.2).
 *
 * Pure functions over the content document, deliberately separate from the
 * route: the interesting parts are text rules — what to say when the organizer
 * wrote no theme, where to cut a long description — and those are worth
 * pinning with tests rather than eyeballing in a link preview.
 *
 * Nothing here invents facts about the event. Same rule the template follows
 * (Phase 4): the platform describes TED and TEDx, never the organizer's
 * programme.
 */

/** Facebook and LinkedIn truncate around here; Google shows less still. */
const DESCRIPTION_MAX_LENGTH = 200;

/** The Open Graph standard card, and what both Facebook and X expect. */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/**
 * The card description.
 *
 * Prefers the theme, which is a deliberate one-line summary of the event and
 * exactly the right length. Falls back to the About text, truncated — an
 * organizer who wrote no theme but did write a paragraph is better served by a
 * cut paragraph than by generic platform copy.
 *
 * Returns `null` when there is neither, rather than substituting a description
 * of TEDx in general. A shared link that describes the movement instead of the
 * event reads as a stub, and Google is entitled to write a better snippet from
 * the page than we can from two empty fields.
 */
export function siteDescription(content: EventContent): string | null {
  const theme = content.theme?.trim();
  if (theme) return truncate(theme, DESCRIPTION_MAX_LENGTH);

  const about = content.about?.trim();
  if (about) return truncate(collapseWhitespace(about), DESCRIPTION_MAX_LENGTH);

  return null;
}

/**
 * The social card image, or `null` when the event has no hero image.
 *
 * Only the hero is considered. A speaker portrait or the venue photo would
 * technically fill the space, but a card is read as "this is the event", and
 * cropping one person's headshot to 1200×630 misrepresents whose event it is.
 * No hero means no image, and the platforms fall back to a text-only card.
 *
 * Cropped rather than fitted: social platforms letterbox or centre-crop
 * whatever they are given, so doing it here with `g_auto` at least puts the
 * subject in the frame.
 */
export function siteCardImage(content: EventContent): { url: string; alt: string } | null {
  const hero = content.heroImage;
  if (hero === null) return null;

  const url = cloudinaryUrl(hero.cloudinaryPublicId, {
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    crop: "fill",
  });
  // `null` when Cloudinary is unconfigured — the same degradation every other
  // image path takes, so a misconfigured deployment gets a text card rather
  // than a card pointing at a broken URL.
  if (url === null) return null;

  // The hero is decorative in the page (Phase 1: `EventContent` images carry no
  // alt text), but a social card is *only* this image, so it needs a
  // description. The display name is the honest one — it says what the picture
  // represents without claiming to describe what is in it.
  return { url, alt: content.displayName };
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ");
}

/**
 * Cuts at a word boundary, never mid-word, and only when the text is actually
 * too long — an ellipsis on a description that fit is a small lie about there
 * being more.
 */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;

  // Reserve one character for the ellipsis.
  const clipped = text.slice(0, max - 1);
  const lastSpace = clipped.lastIndexOf(" ");

  // A single word longer than the limit has no boundary to cut at; a hard cut
  // is the only option left.
  return `${(lastSpace === -1 ? clipped : clipped.slice(0, lastSpace)).trimEnd()}…`;
}

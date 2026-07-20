import type { EventContent } from "@/content/event-content";
import { sectionVisibility } from "@/content/serializer";

/**
 * Aurora's section anchors and the nav built from them.
 *
 * The visibility *rule* is domain logic and lives in `sectionVisibility`
 * (BR-13); what lives here is purely presentational — which sections Aurora
 * gives an anchor to, what it calls them, and in what order they appear. A
 * second template could label or order them completely differently without
 * either of us re-deciding what "empty" means.
 *
 * Deriving the nav from the same predicate that decides whether a section
 * renders is the point: a link that scrolls to nothing is worse than no link,
 * and this makes that state unrepresentable.
 */

export const AURORA_SECTION_IDS = {
  about: "about",
  speakers: "speakers",
  venue: "venue",
  team: "team",
  sponsors: "sponsors",
  faqs: "faq",
  contact: "contact",
} as const;

export type AuroraSectionKey = keyof typeof AURORA_SECTION_IDS;

export interface AuroraNavItem {
  /** The DOM id of the target section, without the `#`. */
  id: string;
  label: string;
}

/**
 * Nav order, which is also the order the renderer lays the sections out.
 *
 * Speakers sit directly after About because they are the reason most visitors
 * came; the logistics (venue, FAQ, contact) trail the programme.
 */
const NAV_ORDER: readonly { key: AuroraSectionKey; label: string }[] = [
  { key: "about", label: "About" },
  { key: "speakers", label: "Speakers" },
  { key: "venue", label: "Venue" },
  { key: "team", label: "Team" },
  { key: "sponsors", label: "Sponsors" },
  { key: "faqs", label: "FAQ" },
  { key: "contact", label: "Contact" },
];

/**
 * The nav for one document.
 *
 * The Hero is deliberately not an entry: it is where the visitor already is,
 * and Aurora's wordmark links back to the top for the same purpose. Sections
 * that are always rendered but carry no organizer content (About TED, About
 * TEDx, the disclaimer) are likewise omitted — they are legal and contextual
 * footer material, not destinations.
 *
 * An empty result is normal, not a bug: a minimal draft (display name only)
 * has no optional sections at all, and the nav simply collapses to the
 * wordmark. See task 4.7's fallback verification.
 */
export function auroraNavItems(content: EventContent): AuroraNavItem[] {
  const visible = sectionVisibility(content);

  return NAV_ORDER.filter(({ key }) => visible[key]).map(({ key, label }) => ({
    id: AURORA_SECTION_IDS[key],
    label,
  }));
}

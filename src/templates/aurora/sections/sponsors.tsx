import type { SponsorContent } from "@/content/event-content";
import { cn } from "@/lib/utils";

import { AuroraImage, resolveImage } from "../components/image";
import { Reveal } from "../components/reveal";
import { AuroraSection } from "../components/section";
import { AURORA_SECTION_IDS } from "../sections";
import { TIER_LOGO_HEIGHT, groupSponsorsByTier } from "../lib/sponsors";

/**
 * Sponsors, grouped by tier.
 *
 * Two independent auto-hide rules meet here (FR-38): the whole section
 * disappears when there are no sponsors at all (the renderer's decision, via
 * `sectionVisibility`), and each *tier* disappears when it has no sponsors
 * (`groupSponsorsByTier`). A site with only community supporters shows one
 * group, not six, five of them empty.
 */

const LOGO_SIZES = "(min-width: 640px) 16rem, 40vw";

/**
 * Logos sit on a light tile rather than directly on Aurora's near-black.
 *
 * Sponsor artwork is supplied by third parties and is overwhelmingly designed
 * for white backgrounds — dark wordmarks, dark-on-transparent PNGs. Inverting
 * or recolouring them would breach the brand guidelines organizers are
 * contractually bound to, so the template gives them the background they
 * expect instead.
 */
function SponsorLogo({
  sponsor,
  heightClass,
  decorative,
}: {
  sponsor: SponsorContent;
  heightClass: string;
  /**
   * True when an ancestor link already carries the sponsor's accessible name.
   * Without this the name is announced twice — once as the image's alt text and
   * once as the link's label.
   */
  decorative: boolean;
}) {
  const resolved = resolveImage(sponsor.logo);

  if (resolved === null || sponsor.logo === null) {
    // No logo yet — the name set in the same typographic weight keeps the row
    // even, and is what most community-tier sponsors get anyway.
    return (
      <span className="text-aurora-fog group-hover:text-aurora-snow text-lg font-semibold transition-colors">
        {sponsor.name}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-xl bg-white/92 px-5 py-3 transition-colors group-hover:bg-white",
        heightClass,
      )}
    >
      <AuroraImage
        image={sponsor.logo}
        alt={decorative ? "" : sponsor.name}
        sizes={LOGO_SIZES}
        className="max-h-full w-auto object-contain"
      />
    </span>
  );
}

export function AuroraSponsors({ sponsors }: { sponsors: SponsorContent[] }) {
  const groups = groupSponsorsByTier(sponsors);

  return (
    <AuroraSection id={AURORA_SECTION_IDS.sponsors} eyebrow="With thanks to" title="Sponsors" wide>
      <div className="space-y-14">
        {groups.map((group) => (
          <Reveal key={group.tier}>
            <section aria-labelledby={`sponsors-${group.tier.toLowerCase()}`}>
              <h3
                id={`sponsors-${group.tier.toLowerCase()}`}
                className="text-aurora-eyebrow text-aurora-fog border-aurora-line/60 border-b pb-4 font-semibold uppercase"
              >
                {group.label}
              </h3>

              <ul className="mt-8 flex flex-wrap items-center gap-x-10 gap-y-8">
                {group.sponsors.map((sponsor) => (
                  <li key={sponsor.id} className="group">
                    {sponsor.websiteUrl !== null ? (
                      <a
                        href={sponsor.websiteUrl}
                        // BR-12: an organizer-supplied external destination.
                        target="_blank"
                        rel="noopener noreferrer"
                        // An explicit label rather than relying on the contents:
                        // a logo-only sponsor would otherwise give the link no
                        // accessible name at all.
                        aria-label={`${sponsor.name} — visit website`}
                        className="flex items-center"
                      >
                        <SponsorLogo
                          sponsor={sponsor}
                          heightClass={TIER_LOGO_HEIGHT[sponsor.tier]}
                          decorative
                        />
                      </a>
                    ) : (
                      <span className="flex items-center">
                        <SponsorLogo
                          sponsor={sponsor}
                          heightClass={TIER_LOGO_HEIGHT[sponsor.tier]}
                          decorative={false}
                        />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>
        ))}
      </div>
    </AuroraSection>
  );
}

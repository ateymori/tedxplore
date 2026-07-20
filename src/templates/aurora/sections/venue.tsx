import { MapPin } from "lucide-react";

import type { VenueContent } from "@/content/event-content";

import { AuroraImage } from "../components/image";
import { Reveal } from "../components/reveal";
import { AuroraProse } from "../components/prose";
import { AuroraSection } from "../components/section";
import { AURORA_SECTION_IDS } from "../sections";

/**
 * Where the event happens.
 *
 * Map-free by design (task 4.3): an embedded map is a third-party script, a
 * cookie banner, an API key, and a Lighthouse penalty, in exchange for
 * something the address alone already answers. The address is instead a
 * `geo:`-free plain-text block a visitor can select and paste into whatever
 * maps app they actually use.
 *
 * Every field is independently optional. The section renders whenever *any*
 * one of them is set (`sectionVisibility.venue`), because an address with no
 * name still helps someone find the door — so each element below has to
 * tolerate its neighbours being absent, and the layout has to hold up when
 * only one of the four exists.
 */
export function AuroraVenue({ venue }: { venue: VenueContent }) {
  const hasText = venue.address !== null || venue.description !== null;

  return (
    <AuroraSection
      id={AURORA_SECTION_IDS.venue}
      eyebrow="Venue"
      title={venue.name ?? "Where to find us"}
    >
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-16">
        {venue.image !== null ? (
          <Reveal className="lg:order-last">
            <AuroraImage
              image={venue.image}
              // The venue name is the best description available; when it is
              // unset there is nothing meaningful to say, and an invented
              // string would be worse than none (NFR-3).
              alt={venue.name ?? ""}
              sizes="(min-width: 1024px) 50vw, 100vw"
              crop="fill"
              aspectRatio={4 / 3}
              className="border-aurora-line/60 w-full rounded-2xl border object-cover"
            />
          </Reveal>
        ) : null}

        {hasText ? (
          <Reveal className="space-y-8">
            {venue.address !== null ? (
              <address className="flex gap-4 not-italic">
                <MapPin aria-hidden="true" className="text-aurora-ember mt-1 size-5 shrink-0" />
                <span className="text-aurora-snow text-aurora-h3 whitespace-pre-line">
                  {venue.address}
                </span>
              </address>
            ) : null}

            {venue.description !== null ? (
              <AuroraProse text={venue.description} className="text-aurora-fog text-aurora-lead" />
            ) : null}
          </Reveal>
        ) : null}
      </div>
    </AuroraSection>
  );
}

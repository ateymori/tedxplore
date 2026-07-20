import { ArrowUpRight } from "lucide-react";

import { ABOUT_TED, ABOUT_TEDX } from "@/config/platform-copy";

import { Reveal } from "../components/reveal";
import { AuroraContainer } from "../components/section";

/**
 * About TED and About TEDx — always rendered, verbatim, for every event
 * (FR-37, FR-38).
 *
 * There is deliberately no conditional logic in this file. These blocks have no
 * organizer-editable portion in V1, so there is no empty state to hide and no
 * default to fall back to; the copy is fixed platform text from
 * `config/platform-copy.ts` and the template's only job is to set it well.
 *
 * They sit below the event's own content and carry no nav entry: a visitor
 * navigates to speakers or the venue, not to institutional background.
 */

interface BlockProps {
  id: string;
  heading: string;
  subheading?: string;
  body: readonly string[];
  linkLabel: string;
  linkUrl: string;
}

function PlatformBlock({ id, heading, subheading, body, linkLabel, linkUrl }: BlockProps) {
  const headingId = `${id}-heading`;

  return (
    <Reveal>
      <section aria-labelledby={headingId}>
        <h2 id={headingId} className="text-aurora-h3 text-aurora-snow">
          {heading}
          {subheading !== undefined ? (
            <span className="text-aurora-fog/70 ml-2 text-base font-normal">{subheading}</span>
          ) : null}
        </h2>

        <div className="text-aurora-fog mt-5 space-y-4 text-sm leading-relaxed">
          {body.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
        </div>

        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-aurora-ember hover:text-aurora-snow mt-5 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          {linkLabel}
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </a>
      </section>
    </Reveal>
  );
}

export function AuroraPlatformAbout() {
  return (
    <div className="border-aurora-line/50 border-t py-aurora-section">
      <AuroraContainer>
        <div className="grid gap-14 md:grid-cols-2 md:gap-16">
          <PlatformBlock
            id="about-ted"
            heading={ABOUT_TED.heading}
            body={ABOUT_TED.body}
            linkLabel={ABOUT_TED.linkLabel}
            linkUrl={ABOUT_TED.linkUrl}
          />
          <PlatformBlock
            id="about-tedx"
            heading={ABOUT_TEDX.heading}
            subheading={ABOUT_TEDX.subheading}
            body={ABOUT_TEDX.body}
            linkLabel={ABOUT_TEDX.linkLabel}
            linkUrl={ABOUT_TEDX.linkUrl}
          />
        </div>
      </AuroraContainer>
    </div>
  );
}

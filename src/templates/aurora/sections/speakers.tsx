import type { SpeakerContent } from "@/content/event-content";

import { RevealGroup } from "../components/reveal";
import { AuroraPortrait } from "../components/portrait";
import { AuroraSection } from "../components/section";
import { AuroraSpeakerCard } from "../components/speaker-card";
import { AURORA_SECTION_IDS } from "../sections";

/**
 * The programme.
 *
 * Placed directly after About because the speakers are why most visitors came;
 * logistics trail the line-up (see `NAV_ORDER`).
 *
 * Three columns at the top breakpoint rather than four: at the BR-11 maximum of
 * sixteen speakers, four columns produce portraits too small to recognize a
 * face in, and the extra row costs nothing on a page people scroll anyway.
 */
const SIZES = "(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 90vw";

// No standfirst under the heading: any sentence the template could write there
// would be a claim about someone else's event ("eight talks", "a full day of
// ideas") that may simply be untrue. Platform copy states facts about TED and
// TEDx (see `config/platform-copy.ts`), never about the programme.
export function AuroraSpeakers({ speakers }: { speakers: SpeakerContent[] }) {
  return (
    <AuroraSection id={AURORA_SECTION_IDS.speakers} eyebrow="Programme" title="Speakers" wide>
      <RevealGroup className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {speakers.map((speaker) => (
          <AuroraSpeakerCard
            key={speaker.id}
            speaker={speaker}
            portrait={<AuroraPortrait photo={speaker.photo} name={speaker.name} sizes={SIZES} />}
          />
        ))}
      </RevealGroup>
    </AuroraSection>
  );
}

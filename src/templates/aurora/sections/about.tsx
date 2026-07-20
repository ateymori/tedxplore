import { Reveal } from "../components/reveal";
import { AuroraProse } from "../components/prose";
import { AuroraSection } from "../components/section";
import { AURORA_SECTION_IDS } from "../sections";

/**
 * The organizer's description of their event.
 *
 * Optional and auto-hiding (BR-13) — the renderer decides whether to mount
 * this at all, so the non-null assertion the props make is safe by
 * construction. No fallback copy: an event with nothing written about it shows
 * no About section, rather than something the platform invented on the
 * organizer's behalf.
 */
export function AuroraAbout({ about }: { about: string }) {
  return (
    <AuroraSection id={AURORA_SECTION_IDS.about} eyebrow="About" title="About the event">
      <Reveal>
        <AuroraProse
          text={about}
          className="text-aurora-lead text-aurora-fog max-w-3xl [&>p:first-child]:text-aurora-snow"
        />
      </Reveal>
    </AuroraSection>
  );
}

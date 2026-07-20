import type { TeamMemberContent } from "@/content/event-content";

import { RevealGroup } from "../components/reveal";
import { AuroraPortrait } from "../components/portrait";
import { AuroraSection } from "../components/section";
import { AuroraSocialLinks } from "../components/social-links";
import { AURORA_SECTION_IDS } from "../sections";

/**
 * The organizing team.
 *
 * Denser than the speakers grid on purpose. Teams run to thirty people
 * (BR-11) and the visitor is scanning for names and roles, not studying faces
 * — and there is no detail interaction here because a team member has no bio
 * field to reveal.
 */
const SIZES = "(min-width: 1024px) 14rem, (min-width: 640px) 30vw, 45vw";

export function AuroraTeam({ team }: { team: TeamMemberContent[] }) {
  return (
    <AuroraSection id={AURORA_SECTION_IDS.team} eyebrow="Behind the event" title="Team" wide>
      <RevealGroup className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
        {team.map((member) => (
          <article key={member.id}>
            <AuroraPortrait photo={member.photo} name={member.name} sizes={SIZES} />
            <p className="text-aurora-snow mt-4 font-semibold">{member.name}</p>
            {member.role !== null ? (
              <p className="text-aurora-fog/80 mt-0.5 text-sm">{member.role}</p>
            ) : null}
            <AuroraSocialLinks links={member.links} owner={member.name} className="mt-2 -ml-2" />
          </article>
        ))}
      </RevealGroup>
    </AuroraSection>
  );
}

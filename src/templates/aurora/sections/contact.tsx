import { Mail } from "lucide-react";

import type { ContactContent } from "@/content/event-content";

import { Reveal } from "../components/reveal";
import { AuroraSection } from "../components/section";
import { AuroraSocialLinks } from "../components/social-links";
import { AURORA_SECTION_IDS } from "../sections";

/**
 * How to reach the organizers.
 *
 * Both elements are independently optional and the section renders when either
 * exists (`sectionVisibility.contact`), so neither may assume the other.
 *
 * A `mailto:` link rather than a contact form: a form needs a server endpoint,
 * spam protection, and somewhere to deliver to, none of which V1 has — and the
 * organizer gave us an address precisely so people would write to it.
 */
export function AuroraContact({
  contact,
  displayName,
}: {
  contact: ContactContent;
  displayName: string;
}) {
  return (
    <AuroraSection id={AURORA_SECTION_IDS.contact} eyebrow="Say hello" title="Get in touch">
      <Reveal className="flex flex-col items-start gap-8">
        {contact.email !== null ? (
          <a
            href={`mailto:${contact.email}`}
            className="text-aurora-snow hover:text-aurora-ember text-aurora-h3 inline-flex items-center gap-4 transition-colors"
          >
            <Mail aria-hidden="true" className="text-aurora-ember size-6 shrink-0" />
            <span className="break-all">{contact.email}</span>
          </a>
        ) : null}

        <AuroraSocialLinks
          links={contact.socialLinks}
          owner={displayName}
          size="md"
          className="-ml-2"
        />
      </Reveal>
    </AuroraSection>
  );
}

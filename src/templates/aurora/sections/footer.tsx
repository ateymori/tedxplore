import { TEDX_DISCLAIMER } from "@/config/platform-copy";
import type { EventContent } from "@/content/event-content";

import { AuroraContainer } from "../components/section";
import { AuroraSocialLinks } from "../components/social-links";

/**
 * The required footer (FR-37, FR-38).
 *
 * The display name and the TEDx disclaimer always render — the disclaimer is a
 * licensing obligation (A-2) and is not conditional on anything. The
 * organizer's optional elements (contact address, social links) each hide
 * individually when blank, exactly as they do elsewhere on the page.
 *
 * The copyright year comes from `now` rather than `new Date()` so it stays a
 * pure function of its inputs: published sites are statically rendered
 * (Phase 8), and a build-time year would silently go stale on a site nobody
 * republishes in January.
 */
export function AuroraFooter({ content, now }: { content: EventContent; now: Date }) {
  const { contact, displayName } = content;

  return (
    <footer className="border-aurora-line/50 border-t py-14">
      <AuroraContainer>
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md">
            <p className="text-aurora-snow text-lg font-semibold tracking-tight">{displayName}</p>

            {/* The disclaimer is required verbatim on every published site. */}
            <p className="text-aurora-fog/80 mt-3 text-sm leading-relaxed">{TEDX_DISCLAIMER}</p>
          </div>

          <div className="flex flex-col items-start gap-4 md:items-end">
            {contact.email !== null ? (
              <a
                href={`mailto:${contact.email}`}
                className="text-aurora-fog hover:text-aurora-snow text-sm transition-colors"
              >
                {contact.email}
              </a>
            ) : null}

            <AuroraSocialLinks
              links={contact.socialLinks}
              owner={displayName}
              className="-mx-2 md:justify-end"
            />

            <p className="text-aurora-fog/60 text-xs">{`© ${now.getFullYear()} ${displayName}`}</p>
          </div>
        </div>
      </AuroraContainer>
    </footer>
  );
}

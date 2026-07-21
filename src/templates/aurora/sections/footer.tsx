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
export function AuroraFooter({
  content,
  now,
  reportSlot,
}: {
  content: EventContent;
  now: Date;
  reportSlot?: React.ReactNode;
}) {
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

            {/*
              `/70`, not `/60`. At 12px this is the smallest text on the page,
              and `fog/60` over the near-black background composites to #676972
              — 3.68:1, under the 4.5:1 AA minimum (task 4.8's Lighthouse run
              caught it). `/70` reaches 4.64:1 and is still visibly quieter than
              the disclaimer above it.

              Worth remembering when adding a token: CSS composites alpha in
              *gamma* space, so a light foreground at reduced opacity over a
              dark background is much darker than averaging the two suggests.
            */}
            <p className="text-aurora-fog/70 text-xs">{`© ${now.getFullYear()} ${displayName}`}</p>

            {/*
              FR-45's "report this site" affordance, supplied by the route (see
              `reportSlot` on `TemplateRenderProps`). Deliberately the quietest
              thing in the footer: it has to be findable by someone looking for
              it and invisible to everyone else, because it sits on the
              organizer's own site.

              Absent on the homepage demo and in previews, which have no real
              event to report — hence the null check rather than an assumption.
            */}
            {reportSlot ? <div className="mt-3">{reportSlot}</div> : null}
          </div>
        </div>
      </AuroraContainer>
    </footer>
  );
}

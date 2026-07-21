import { cn } from "@/lib/utils";
import { sectionVisibility } from "@/content/serializer";
import type { TemplateRenderProps } from "@/templates/types";

import { AuroraSiteNav } from "./components/site-nav";
import { auroraFontClassName } from "./fonts";
import { auroraNavItems } from "./sections";
import { AuroraAbout } from "./sections/about";
import { AuroraContact } from "./sections/contact";
import { AuroraFaq } from "./sections/faq";
import { AuroraFooter } from "./sections/footer";
import { AuroraHero } from "./sections/hero";
import { AuroraPlatformAbout } from "./sections/platform";
import { AuroraSpeakers } from "./sections/speakers";
import { AuroraSponsors } from "./sections/sponsors";
import { AuroraTeam } from "./sections/team";
import { AuroraVenue } from "./sections/venue";

/**
 * Aurora.
 *
 * A Server Component, and so is every section under it — only three leaves are
 * client-side (the nav's scroll-spy, the countdown's clock, and the speaker
 * dialog), and each of them is enhancement over markup that already works.
 * Reveals and parallax are CSS scroll-driven animations, not JavaScript, so a
 * published site is statically rendered and fully readable before a single
 * script runs (NFR-1).
 *
 * The renderer takes `EventContent` and nothing else. It has no database
 * access, no knowledge of events, drafts, or snapshots, and no way to ask a
 * question of anything outside its props (C-1) — which is precisely why the
 * same component renders the public site, the owner's draft preview, a
 * tokenized preview link, and the homepage's demo, with only `mode` differing.
 *
 * Section order and visibility are the only structural decisions made here.
 * Everything else belongs to the sections themselves.
 */
export function AuroraRenderer({ content, mode, now, reportSlot }: TemplateRenderProps) {
  // The one authority on which optional sections exist (BR-13). The nav is
  // built from the same call, so a link can never point at a section that
  // wasn't rendered.
  const visible = sectionVisibility(content);
  const navItems = auroraNavItems(content);

  return (
    <div
      className={cn("aurora relative min-h-screen", auroraFontClassName)}
      // Not read by any style today; it makes the render mode visible in the
      // DOM, which is how Phase 6's preview banner and Phase 8's public/preview
      // distinction will hang off it without re-threading the prop.
      data-render-mode={mode}
    >
      {/* Aurora's own skip link — the app's chrome (and its skip link) is
            deliberately absent from public event sites. */}
      <a
        href="#main"
        className="bg-aurora-snow text-aurora-void sr-only rounded-full px-5 py-3 text-sm font-semibold focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[70]"
      >
        Skip to content
      </a>

      <AuroraSiteNav
        displayName={content.displayName}
        items={navItems}
        registrationUrl={content.registrationUrl}
      />

      <main id="main">
        <AuroraHero content={content} />

        {/*
            `content.about !== null` below is a type narrowing, not a second
            visibility rule: `sectionVisibility.about` is defined as exactly
            that test. The sections taking whole objects need no equivalent.
          */}
        {visible.about && content.about !== null ? <AuroraAbout about={content.about} /> : null}

        {visible.speakers ? <AuroraSpeakers speakers={content.speakers} /> : null}
        {visible.venue ? <AuroraVenue venue={content.venue} /> : null}
        {visible.team ? <AuroraTeam team={content.team} /> : null}
        {visible.sponsors ? <AuroraSponsors sponsors={content.sponsors} /> : null}
        {visible.faqs ? <AuroraFaq faqs={content.faqs} /> : null}
        {visible.contact ? (
          <AuroraContact contact={content.contact} displayName={content.displayName} />
        ) : null}
      </main>

      {/* Always rendered, for every event, unconditionally (FR-38). */}
      <AuroraPlatformAbout />
      <AuroraFooter content={content} now={now} reportSlot={reportSlot} />
    </div>
  );
}

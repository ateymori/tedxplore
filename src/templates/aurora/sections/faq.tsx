import { Plus } from "lucide-react";

import type { FaqContent } from "@/content/event-content";

import { RevealGroup } from "../components/reveal";
import { AuroraProse } from "../components/prose";
import { AuroraSection } from "../components/section";
import { AURORA_SECTION_IDS } from "../sections";

/**
 * The FAQ accordion.
 *
 * Native `<details>`/`<summary>` rather than a headless accordion component —
 * a deliberate exception to the template's use of Base UI elsewhere (the
 * speaker dialog).
 *
 * The browser gives us the entire disclosure pattern for free: correct
 * `button` semantics, expanded/collapsed state announced by every screen
 * reader, keyboard operation, and — the reason that matters here — in-page
 * find (Ctrl+F) that opens the matching answer. A JavaScript accordion breaks
 * that last one, and hides FAQ text from search engines' rendered text on a
 * page whose whole job is to answer questions. It also ships no JavaScript at
 * all, which suits a statically rendered public site (NFR-1).
 *
 * Only the open/close *animation* needs modern CSS, and it degrades to an
 * instant toggle where `::details-content` is unsupported.
 */
export function AuroraFaq({ faqs }: { faqs: FaqContent[] }) {
  return (
    <AuroraSection id={AURORA_SECTION_IDS.faqs} eyebrow="Good to know" title="Frequently asked">
      <RevealGroup className="border-aurora-line/60 max-w-3xl border-t">
        {faqs.map((faq) => (
          <details key={faq.id} className="aurora-faq border-aurora-line/60 group border-b">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-6 text-left">
              <span className="text-aurora-snow group-hover:text-aurora-ember text-lg font-medium transition-colors">
                {faq.question}
              </span>
              <Plus
                aria-hidden="true"
                className="text-aurora-fog mt-1 size-5 shrink-0 transition-transform duration-300 group-open:rotate-45"
              />
            </summary>

            <div className="pb-7">
              <AuroraProse
                text={faq.answer}
                className="text-aurora-fog max-w-2xl leading-relaxed"
              />
            </div>
          </details>
        ))}
      </RevealGroup>
    </AuroraSection>
  );
}

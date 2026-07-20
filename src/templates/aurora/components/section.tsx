import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Reveal } from "./reveal";

/**
 * The frame every Aurora section sits in.
 *
 * Centralizes the things that must not vary between sections — vertical
 * rhythm, measure, heading rank, the anchor target the nav scrolls to — so
 * adding a section in 4.3–4.6 is a matter of writing its body, not of
 * re-deciding its geometry.
 *
 * `data-aurora-section` is what the nav's scroll-spy observes and what the
 * stylesheet hangs `scroll-margin-top` on; it is set here rather than at each
 * call site so a section cannot be added without it.
 */

/** Aurora's one content measure. Wider than prose, narrow enough to feel composed. */
export function AuroraContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-6 sm:px-8 lg:px-12", className)}>
      {children}
    </div>
  );
}

interface SectionProps {
  /** Anchor id from `AURORA_SECTION_IDS`. */
  id: string;
  /** The small tracked label above the heading. */
  eyebrow?: string;
  title: string;
  /** Optional standfirst under the heading. */
  intro?: string | null;
  children: ReactNode;
  className?: string;
  /** Renders the heading and body full-width, for grids that need the room. */
  wide?: boolean;
}

export function AuroraSection({
  id,
  eyebrow,
  title,
  intro,
  children,
  className,
  wide = false,
}: SectionProps) {
  const headingId = `${id}-heading`;

  return (
    <section
      id={id}
      data-aurora-section
      aria-labelledby={headingId}
      className={cn("py-aurora-section", className)}
    >
      <AuroraContainer>
        <Reveal>
          <div className={cn(wide ? "max-w-3xl" : "max-w-2xl")}>
            {eyebrow ? (
              <p className="text-aurora-eyebrow text-aurora-ember mb-5 font-semibold uppercase">
                {eyebrow}
              </p>
            ) : null}
            <h2 id={headingId} className="text-aurora-h2 text-aurora-snow">
              {title}
            </h2>
            {intro ? <p className="text-aurora-lead text-aurora-fog mt-6">{intro}</p> : null}
          </div>
        </Reveal>

        <div className="mt-12 sm:mt-16">{children}</div>
      </AuroraContainer>
    </section>
  );
}

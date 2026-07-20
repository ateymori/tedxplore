import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Aurora's motion primitives.
 *
 * Server Components with no JavaScript at all: the animations are CSS
 * scroll-driven animations (`animation-timeline: view()`), defined in
 * `aurora.css`.
 *
 * This replaced a Motion (`whileInView`) implementation, and the reason is
 * worth keeping. A JavaScript reveal has to render its *pre-animation* state
 * on the server — so every section, including the hero's `<h1>`, was shipped
 * with `style="opacity:0"` and the page stayed blank until hydration. On a
 * statically rendered public site that delays the Largest Contentful Paint
 * behind a JS download for no benefit (NFR-1 targets Lighthouse ≥ 90), and
 * with JavaScript unavailable the page never appears at all.
 *
 * The CSS version inverts that: the content is visible by default and the
 * animation is pure enhancement. Browsers without scroll-driven animation
 * support simply show everything immediately, which is the correct
 * degradation — nothing is ever hidden behind a feature that might not run.
 */

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger position within a group. See the two stagger helpers below. */
  index?: number;
  /**
   * What drives the animation.
   *
   * `"scroll"` (the default) ties it to the element's pass through the
   * viewport, which is what a reveal should be for anything below the fold.
   *
   * `"load"` is for content that is already on screen when the page opens —
   * the hero. A scroll timeline is the wrong tool there: an element sitting
   * low in the first viewport has only partly completed its range at scroll
   * position 0, so it would render permanently half-faded until the visitor
   * scrolled. A plain time-based animation always runs to completion.
   */
  on?: "scroll" | "load";
}

/** Percentage points of scroll range each successive item is pushed back by. */
const STAGGER_STEP = 4;

/**
 * The most stagger any group may accumulate.
 *
 * Without a cap, a 16-speaker grid (the BR-11 maximum) would have its last card
 * still arriving long after the visitor had scrolled past it.
 */
const STAGGER_MAX = 20;

/** Milliseconds between successive items in a load-driven group. */
const ENTER_STAGGER_STEP_MS = 90;
const ENTER_STAGGER_MAX_MS = 450;

function revealStyle(index: number, on: "scroll" | "load"): CSSProperties | undefined {
  if (index === 0) return undefined;

  if (on === "load") {
    return {
      "--aurora-reveal-delay": `${Math.min(index * ENTER_STAGGER_STEP_MS, ENTER_STAGGER_MAX_MS)}ms`,
    } as CSSProperties;
  }

  // A scroll-driven animation is a function of position, not of time, so
  // staggering means offsetting the *range* — `animation-delay` has nothing to
  // delay against a scroll timeline.
  const offset = Math.min(index * STAGGER_STEP, STAGGER_MAX);
  return {
    "--aurora-reveal-start": `${offset}%`,
    "--aurora-reveal-end": `${60 + offset}%`,
  } as CSSProperties;
}

export function Reveal({ children, className, index = 0, on = "scroll" }: RevealProps) {
  return (
    <div
      className={cn(on === "load" ? "aurora-enter" : "aurora-reveal", className)}
      style={revealStyle(index, on)}
    >
      {children}
    </div>
  );
}

/**
 * Reveals children in sequence.
 *
 * Takes an array rather than `children` so it can index them; sections pass
 * `items.map(...)` results directly. The wrapper divs become the grid items,
 * which is why the grid classes belong on this component rather than inside it.
 */
export function RevealGroup({
  children,
  className,
}: {
  children: ReactNode[];
  className?: string;
}) {
  return (
    <div className={className}>
      {children.map((child, index) => (
        // The caller's own keys ride on `child`; this wrapper's key only needs
        // to be positional.
        <Reveal key={index} index={index}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}

/**
 * Scroll-linked vertical drift, for hero and section backdrops only.
 *
 * "Parallax restraint" is enforced by the CSS: roughly 48px of total travel
 * across the element's entire pass through the viewport — enough to give depth,
 * far too little to induce the queasiness heavy parallax does. Foreground
 * content never gets this, because text moving at a different speed from its
 * container is a readability problem, not an effect.
 */
export function Parallax({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="aurora-parallax h-full w-full">{children}</div>
    </div>
  );
}

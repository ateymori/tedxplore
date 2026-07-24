import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface RollingArrowProps {
  iconSize?: number;
  strokeWidth?: number;
  name?: string;
  className?: string;
}

function trackHoverClasses(name?: string): string {
  if (name === "cta") {
    return "group-hover/cta:translate-x-full";
  }
  return "group-hover:translate-x-full";
}

/**
 * An arrow that rolls out to the right and is replaced by an identical arrow
 * sliding in from the left, on hover of an ancestor `group` (or `group/cta`
 * when `name="cta"` — for when a rolling arrow sits inside a wider group that
 * has its own unrelated hover state).
 */
export function RollingArrow({
  iconSize = 16,
  strokeWidth,
  name,
  className,
}: RollingArrowProps): ReactNode {
  return (
    <span
      className={cn("relative inline-block overflow-hidden align-middle", className)}
      style={{ width: iconSize, height: iconSize }}
      aria-hidden
    >
      <span
        className={cn(
          "absolute inset-0 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
          trackHoverClasses(name),
        )}
      >
        <span className="absolute inset-0 flex items-center justify-center">
          <ArrowRight width={iconSize} height={iconSize} strokeWidth={strokeWidth} />
        </span>
        <span
          className="absolute inset-y-0 right-full flex items-center justify-center"
          style={{ width: iconSize }}
        >
          <ArrowRight width={iconSize} height={iconSize} strokeWidth={strokeWidth} />
        </span>
      </span>
    </span>
  );
}

interface ArrowChipProps extends RollingArrowProps {
  padX?: string;
  padY?: string;
}

/**
 * The chip half of a two-part CTA (label chip + this arrow chip, laid out
 * side by side with a small gap by the caller). Reserves space for one arrow
 * (the invisible spacer) and rolls a second one in from off-screen on hover.
 */
export function ArrowChip({
  className = "bg-accent text-accent-foreground",
  padX = "px-3",
  padY = "py-3",
  iconSize = 16,
  strokeWidth,
  name,
}: ArrowChipProps): ReactNode {
  return (
    <span
      className={cn(
        "relative inline-flex h-full items-center justify-center overflow-hidden rounded-md",
        padX,
        padY,
        className,
      )}
      aria-hidden
    >
      <span className="invisible" style={{ width: iconSize, height: iconSize }} />

      <span
        className={cn(
          "absolute inset-0 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
          trackHoverClasses(name),
        )}
      >
        <span className="absolute inset-0 flex items-center justify-center">
          <ArrowRight width={iconSize} height={iconSize} strokeWidth={strokeWidth} />
        </span>
        <span className="absolute inset-y-0 right-full flex w-full items-center justify-center">
          <ArrowRight width={iconSize} height={iconSize} strokeWidth={strokeWidth} />
        </span>
      </span>
    </span>
  );
}

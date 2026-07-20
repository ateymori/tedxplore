import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Aurora's outbound link button.
 *
 * Every destination it can point at is organizer-supplied and therefore
 * external and untrusted (registration URLs, sponsor sites, social profiles),
 * so `target="_blank" rel="noopener noreferrer"` is baked in rather than left
 * to each call site to remember. The URL itself was already validated as
 * http/https by the serializer (BR-12) before it reached `EventContent`.
 */

const VARIANTS = {
  primary: "bg-aurora-red text-white hover:bg-aurora-ember",
  outline: "border border-aurora-line text-aurora-snow hover:border-aurora-fog hover:bg-white/5",
} as const;

interface AuroraLinkButtonProps {
  href: string;
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  className?: string;
}

export function AuroraLinkButton({
  href,
  children,
  variant = "primary",
  className,
}: AuroraLinkButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold transition-colors",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </a>
  );
}

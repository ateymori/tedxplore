import { cn } from "@/lib/utils";

/**
 * Aurora's default hero visual (FR-38).
 *
 * The fallback that renders whenever the organizer has not uploaded hero
 * imagery — which is every brand-new event, since only a slug and a display
 * name are required to create one (FR-8), and the demo content ships with no
 * images at all so this path is exercised from day one.
 *
 * Built from CSS gradients rather than a shipped image on purpose: it costs no
 * bytes and no request, it is resolution-independent from 360px to 4K, and it
 * cannot be mistaken for an organizer's own photograph. It is also the
 * template's namesake — the point is that a site with nothing uploaded still
 * looks deliberately designed rather than unfinished.
 *
 * Purely decorative, so it is hidden from assistive technology.
 */
export function AuroraBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("absolute inset-0 overflow-hidden", className)}>
      <div className="bg-aurora-void absolute inset-0" />

      {/* Three offset colour fields. Kept well below full saturation so hero
          text stays comfortably above contrast minimums wherever it lands. */}
      <div className="aurora-veil aurora-veil--violet" />
      <div className="aurora-veil aurora-veil--teal" />
      <div className="aurora-veil aurora-veil--red" />

      {/* Grain, which is what stops large gradients from banding on 8-bit
          displays and gives the whole thing a photographic rather than
          synthetic feel. */}
      <div className="aurora-grain absolute inset-0" />

      {/* A bottom-weighted scrim so the hero's text sits on a predictable
          value regardless of where the colour fields happen to drift. */}
      <div className="from-aurora-void via-aurora-void/45 absolute inset-0 bg-gradient-to-t to-transparent" />
    </div>
  );
}

import { AuroraBackdrop } from "./components/backdrop";
import { AURORA_DEMO_DISPLAY_NAME, AURORA_DEMO_THEME } from "./demo-content";
import { auroraFontClassName } from "./fonts";

/**
 * Aurora's card artwork for the homepage gallery (FR-49).
 *
 * Drawn with the template's own tokens rather than shipped as a screenshot,
 * for the same reasons the hero fallback is CSS (`components/backdrop.tsx`) and
 * one more that only applies here: a screenshot is a *copy* of the template,
 * and copies go stale. Every change to Aurora's palette or type would silently
 * leave the gallery advertising the previous design, with nothing to catch it.
 * This cannot drift, because it is made of the same tokens the real site is.
 *
 * It also costs no request and no bytes, stays sharp at any density, and needs
 * no asset pipeline before a second template can be added — which matters more
 * than it sounds, since the whole point of the grid is that Template 2 is a
 * directory and a registry entry (NFR-6).
 *
 * Deliberately *evocative* rather than a faithful miniature. At card size a
 * scaled-down page is illegible mush; what a visitor can actually judge is the
 * palette, the type, and the mood. The Live Preview button is one click away
 * and shows the real thing.
 *
 * Purely decorative: the card states the template's name and description in
 * text directly beneath, so this carries no accessible name of its own.
 */
export function AuroraPoster() {
  return (
    <div
      aria-hidden="true"
      className={`aurora relative flex h-full w-full items-end overflow-hidden ${auroraFontClassName}`}
    >
      <AuroraBackdrop />

      <div className="relative w-full p-6 sm:p-8">
        <p className="text-aurora-eyebrow text-aurora-ember mb-3 font-semibold uppercase">
          Independently organized
        </p>
        <p className="text-aurora-snow font-[family-name:var(--font-aurora-display)] text-2xl leading-[0.95] font-bold tracking-tight sm:text-3xl">
          {AURORA_DEMO_DISPLAY_NAME}
        </p>
        <p className="text-aurora-fog mt-2 text-sm">{AURORA_DEMO_THEME}</p>
      </div>
    </div>
  );
}

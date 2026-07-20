import type { ImageRef } from "@/content/event-content";
import { cn } from "@/lib/utils";

import { AuroraImage, resolveImage } from "./image";

/**
 * A person's photo, or a monogram when there isn't one.
 *
 * Speakers and team members are separate lists with the same problem: photos
 * arrive one at a time, so a half-populated grid is the normal state for weeks.
 * A monogram keeps every cell the same size and weight, which reads as a
 * deliberate style rather than as missing content.
 *
 * This is *not* an FR-38 fallback — those apply to always-rendered sections.
 * A speaker with no photo is still a speaker; a speakers list with no entries
 * hides the section entirely (BR-13). The monogram is simply what a card looks
 * like before its photo exists.
 */

/**
 * Up to two initials, from the first and last whitespace-separated parts.
 *
 * `Array.from` rather than indexing, so a name beginning with an emoji or an
 * astral-plane character yields one whole character instead of half a
 * surrogate pair.
 */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";

  const first = Array.from(parts[0])[0] ?? "";
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? "") : "";

  return (first + last).toUpperCase();
}

export function AuroraPortrait({
  photo,
  name,
  className,
  sizes,
}: {
  photo: ImageRef | null;
  name: string;
  className?: string;
  sizes: string;
}) {
  const resolved = resolveImage(photo, undefined, { crop: "fill", aspectRatio: 1 });

  return (
    <div
      className={cn(
        "bg-aurora-surface border-aurora-line/60 relative aspect-square overflow-hidden rounded-2xl border",
        className,
      )}
    >
      {resolved !== null && photo !== null ? (
        <AuroraImage
          image={photo}
          // The name is rendered directly beneath in every caller, so repeating
          // it here would make a screen reader say it twice (NFR-3).
          alt=""
          sizes={sizes}
          crop="fill"
          aspectRatio={1}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="from-aurora-surface to-aurora-ink flex h-full w-full items-center justify-center bg-gradient-to-br"
        >
          <span className="text-aurora-fog/70 text-3xl font-semibold tracking-tight sm:text-4xl">
            {initials(name)}
          </span>
        </div>
      )}
    </div>
  );
}

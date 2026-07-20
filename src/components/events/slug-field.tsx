"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

import { FieldDescription } from "@/components/ui/field";
import type { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { SITE_DOMAIN, TEDX_PATH_PREFIX } from "@/config/site";
import { isValidSlug } from "@/lib/validation/slug";
import { checkSlugAvailabilityAction } from "@/app/(app)/dashboard/events/actions";

/**
 * The slug input, with the live URL preview and availability check (task 3.1).
 *
 * Shared by event creation and the settings page's slug editor, so the two
 * spell the URL — and the rules around it — identically.
 *
 * The slug's whole purpose is the URL (BR-2), so the URL is what the field
 * shows: the input is secondary to the `tedxplore.com/tedx…` line beneath it.
 */

const AVAILABILITY_DEBOUNCE_MS = 400;

export type SlugAvailabilityState = "idle" | "checking" | "available" | "taken" | "error";

export function slugPreviewUrl(slug: string): string {
  return `${SITE_DOMAIN}${TEDX_PATH_PREFIX}${slug}`;
}

/**
 * Debounced availability lookup for a slug.
 *
 * Only well-formed slugs are sent: an availability answer for "TEDx-2025" is
 * meaningless, and the format error is already on screen from the resolver.
 *
 * Responses are matched against the slug that is current when they land, so a
 * slow answer for an earlier keystroke can never overwrite a newer one — the
 * classic way this control ends up confidently showing the wrong verdict.
 */
type SlugVerdict = Extract<SlugAvailabilityState, "available" | "taken" | "error">;

export function useSlugAvailability(
  slug: string,
  { skip = false }: { skip?: boolean } = {},
): SlugAvailabilityState {
  /**
   * State holds only the *answer*, tagged with the slug it answers for — never
   * the "idle" and "checking" phases, which are facts about the current render
   * and are derived below. Storing them would mean writing state from the
   * effect body on every keystroke, cascading a render each time.
   *
   * Tagging is also what makes stale responses harmless: a verdict is only
   * displayed when its slug still matches the one on screen, so a slow answer
   * for an earlier keystroke is ignored rather than overwriting a newer one.
   */
  const [verdict, setVerdict] = useState<{ slug: string; status: SlugVerdict } | null>(null);
  const shouldCheck = !skip && isValidSlug(slug);

  useEffect(() => {
    if (!shouldCheck) return;

    const timer = setTimeout(() => {
      void checkSlugAvailabilityAction(slug).then(
        (result) => {
          setVerdict({
            slug,
            status: result.ok ? (result.value === "AVAILABLE" ? "available" : "taken") : "error",
          });
        },
        () => {
          setVerdict({ slug, status: "error" });
        },
      );
    }, AVAILABILITY_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [slug, shouldCheck]);

  if (!shouldCheck) return "idle";
  return verdict?.slug === slug ? verdict.status : "checking";
}

export function SlugAvailabilityHint({ state }: { state: SlugAvailabilityState }) {
  // `aria-live` rather than a `FieldError`: availability is advisory feedback
  // that changes as the user types, and screen-reader users need it announced
  // without the field being marked invalid on every intermediate keystroke.
  return (
    <div aria-live="polite" className="min-h-5 text-sm">
      {state === "checking" ? (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Spinner className="size-3.5" />
          Checking availability…
        </span>
      ) : null}
      {state === "available" ? (
        <span className="flex items-center gap-1.5 text-primary">
          <CheckCircle2 className="size-3.5" />
          That address is available.
        </span>
      ) : null}
      {state === "taken" ? (
        <span className="flex items-center gap-1.5 text-destructive">
          <XCircle className="size-3.5" />
          That address is already taken.
        </span>
      ) : null}
      {state === "error" ? (
        <span className="text-muted-foreground">
          Couldn&rsquo;t check availability. You can still continue — we&rsquo;ll confirm when you
          save.
        </span>
      ) : null}
    </div>
  );
}

/** The `tedxplore.com/tedx{slug}` preview shown under the input. */
export function SlugUrlPreview({ slug }: { slug: string }) {
  return (
    <FieldDescription className="font-mono text-sm">
      {slug.length > 0 ? (
        <>
          <span className="text-muted-foreground">
            {SITE_DOMAIN}
            {TEDX_PATH_PREFIX}
          </span>
          <span className="font-medium text-foreground">{slug}</span>
        </>
      ) : (
        <span className="text-muted-foreground">
          {SITE_DOMAIN}
          {TEDX_PATH_PREFIX}
          <span className="italic">yourevent</span>
        </span>
      )}
    </FieldDescription>
  );
}

/**
 * Normalizes what the user types.
 *
 * Uppercase is folded to lowercase rather than rejected: `TEDxMcGill` typed
 * into a URL field is an unambiguous intent, and silently correcting it is
 * kinder than an error the user has to act on. Everything else the charset
 * disallows (digits, hyphens, spaces) is left alone so the validator can
 * explain it — those are real decisions the user has to make, not typos.
 */
export function normalizeSlugInput(value: string): string {
  return value.toLowerCase();
}

/** The input's own props, shared so both slug forms get the same typing behaviour. */
export const slugInputProps = {
  autoCapitalize: "none",
  autoCorrect: "off",
  spellCheck: false,
  className: "font-mono",
} as const satisfies Partial<React.ComponentProps<typeof Input>>;

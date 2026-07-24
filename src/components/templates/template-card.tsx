import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { ArrowChip } from "@/components/arrow-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { templatePreviewPath } from "@/config/routes";
import { templateEditHref } from "@/lib/template-links";
import { getCurrentUser } from "@/server/auth-guards";
import type { TemplateDefinition } from "@/templates/contract";

/**
 * One template in the homepage gallery (FR-49, FR-50).
 *
 * Written against `TemplateDefinition`, never against `aurora`. V1 renders a
 * single card, but nothing here knows that — the grid maps the registry, so
 * Template 2 appears by being registered (NFR-6).
 *
 * The two actions differ in kind, which is why they differ in weight. Live
 * Preview is the low-commitment one and asks for no account (FR-50); Edit is
 * the conversion path and may route through authentication first (FR-51).
 */
export function TemplateCard({
  template,
  editAction,
}: {
  template: TemplateDefinition;
  /**
   * The **Edit** button, injected rather than rendered here (task 8.0).
   *
   * Where it points depends on the session (FR-51), and the session is the one
   * thing on this page that cannot be prerendered. Passing it in as a slot lets
   * the homepage stream *only this button* while the card — poster, name,
   * description, Live Preview — is served static from the first byte. Rendering
   * it inline would make the whole grid session-dependent to decide one `href`.
   *
   * Use `TemplateEditButton` (with `TemplateEditButtonSkeleton` as the Suspense
   * fallback); the pair lives below so the button's styling stays next to the
   * one it sits beside.
   */
  editAction: React.ReactNode;
}) {
  const { Poster } = template;

  return (
    // `group/card` is named deliberately: the two action chips below each carry
    // their own unnamed `group` for the arrow-roll hover (`ArrowChip`'s default
    // `group-hover:`), and an unnamed group here would have made hovering
    // *anywhere on the card* also roll the buttons' arrows — the named variant
    // keeps the poster crossfade scoped to the card itself.
    //
    // `dark:bg-[oklch(0.23_0_0)]` deliberately overrides the theme's own
    // `--card` token (0.205) rather than reusing it: `--card` sits only 0.06L
    // above `--background` (0.145) in dark mode, which is legible enough for
    // surfaces that already carry heavier chrome elsewhere but read as
    // "blending into the page" for a card that's mostly open white space on a
    // homepage whose background *is* `--background` directly. Bumped here,
    // scoped to this component, rather than raising `--card` globally and
    // affecting every dialog/popover that token also drives.
    <article className="group/card @container relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm ring-1 ring-transparent transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5 hover:ring-border dark:border-white/15 dark:bg-[oklch(0.23_0_0)] dark:shadow-md dark:shadow-black/30 dark:hover:shadow-2xl dark:hover:shadow-black/60 dark:hover:ring-white/20">
      {/*
        16:9 with the aspect ratio reserved up front, so the card's height is
        known before the artwork paints and the grid never reflows around it.
        Two layers cross-fade on hover: the resting layer never leaves the DOM
        (it's the keyboard/reduced-motion-safe default), and the recorded clip
        fades in over it — never the reverse — so a template with no recording
        yet just keeps showing its resting artwork. The resting layer is a real
        captured screenshot (`previewThumbnailSrc`) when the template has one —
        it reads as an actual product shot and lines up with the clip it fades
        into — falling back to the token-drawn `Poster` for a template that
        hasn't been captured yet.
      */}
      <div className="relative aspect-video w-full overflow-hidden border-b">
        <div className="absolute inset-0 transition-opacity duration-500 ease-out group-hover/card:opacity-0 group-focus-within/card:opacity-0">
          {template.previewThumbnailSrc ? (
            <img
              src={template.previewThumbnailSrc}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
            />
          ) : (
            <Poster />
          )}
        </div>

        {template.previewAnimationSrc && (
          <img
            src={template.previewAnimationSrc}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="absolute inset-0 h-full w-full scale-105 object-cover opacity-0 transition-opacity duration-500 ease-out group-hover/card:opacity-100 group-focus-within/card:opacity-100"
          />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-6">
        <h3 className="text-lg font-semibold tracking-tight">{template.name}</h3>
        {/* Single-line with `title` fallback once the card is wide enough that
            a cut-off line looks intentional rather than cramped; below that
            (`@container` keyed to the card's own rendered width, not the
            viewport — a half-width card at a mid-size viewport is just as
            narrow as a full-width one on a phone) it wraps to as many lines as
            the description needs instead of clipping it. */}
        <p
          className="text-sm text-muted-foreground @sm:truncate"
          title={template.description}
        >
          {template.description}
        </p>

        {/* `mt-auto` so the actions sit on the card's baseline no matter how
            long a future template's description runs. Below `@sm` each chip
            group goes `w-full` (a narrow card has no room to fit both on one
            line without clipping the primary label — this was reported broken
            in review). At `@sm` and up, `editAction` grows (`@sm:flex-1`, see
            `TemplateEditButton`) to absorb the row's leftover width instead of
            leaving a visible gap beside a compact `Live preview` — which stays
            at its own intrinsic size rather than also stretching. An equal
            50/50 split was considered and rejected twice now, for the same
            reason both times: it visually equates a full commitment with a
            no-commitment click, and with this chip's small tracking-widest
            label it would also leave `Live preview` surrounded by dead space. */}
        <div className="mt-auto flex flex-col gap-3 pt-6 @sm:flex-row @sm:flex-wrap @sm:items-center">
          {/*
            Real anchors throughout, never a `<button>` wrapping a link: both
            actions are navigations, so middle-click, copy-link, and
            open-in-new-tab all depend on it, and a `<button>` announced as a
            button that navigates is a lie to assistive technology.
          */}
          {editAction}

          {/* A plain anchor, not `next/link`: this opens a new tab onto a
              route deliberately outside the app's chrome, so there is no
              client navigation to prefetch. */}
          <a
            href={templatePreviewPath(template.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex w-full items-stretch gap-1 rounded-md outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 dark:focus-visible:ring-white/70 @sm:w-auto"
          >
            {/* `bg-background` reads fine in light mode (white chip on a
                white/near-white card, separated by the border) but in dark
                mode `--background` and `--card` are close enough that a chip
                using the former on a card using the latter came out reading as
                the *page* peeking through a border-only outline — effectively
                invisible except for a 10%-opacity line. The `dark:` overrides
                give it a real, visibly-lighter-than-the-card fill instead, so
                it reads as a button at rest, not just on hover. */}
            <span className="flex-1 rounded-md border border-border bg-background px-5 py-3 text-center text-xs font-medium tracking-widest text-foreground uppercase transition-colors group-hover:bg-muted dark:border-white/20 dark:bg-white/[0.08] dark:group-hover:bg-white/[0.16] @sm:flex-none">
              Live preview
              {/* The icon that used to sit on the button now lives inline in
                  the label — the chip's own arrow is a directional "go to"
                  glyph shared with the primary action, not an affordance for
                  "this leaves the app," so that meaning still needs its own
                  icon. */}
              <ExternalLink aria-hidden="true" className="ml-1.5 inline size-3 align-[-1px]" />
            </span>
            <ArrowChip className="border border-border bg-background text-foreground transition-colors group-hover:bg-muted dark:border-white/20 dark:bg-white/[0.08] dark:group-hover:bg-white/[0.16]" />
            {/* Names the destination *and* the new tab: a link list that reads
                "Live preview" four times over is unusable, and an unannounced
                tab switch is disorienting (NFR-3). */}
            <span className="sr-only">{` of the ${template.name} template, opens in a new tab`}</span>
          </a>
        </div>
      </div>
    </article>
  );
}

/**
 * The **Edit** action (FR-51), streamed because its destination is a function
 * of the session.
 *
 * Signed in it goes straight to event creation for this template; signed out it
 * goes to login carrying a `returnTo` back to the same place. That rule is
 * `templateEditHref` and is unchanged — this component only decides *when* the
 * answer is known, not what it is.
 *
 * Reads the session itself rather than taking it as a prop so the page above it
 * stays synchronous and fully prerenderable. `getCurrentUser` is request-cached,
 * so N cards cost one session lookup.
 */
export async function TemplateEditButton({ templateId }: { templateId: string }) {
  const user = await getCurrentUser();

  return (
    // `w-full` below `@sm` (stacked layout, see `TemplateCard`); at `@sm` and
    // up this is the row's primary action, so `@sm:flex-1` lets it absorb the
    // space a compact `Live preview` chip leaves behind instead of sitting
    // beside a visible gap. The label span stays `flex-1` unconditionally
    // (rather than reverting to its intrinsic width at `@sm`, the way `Live
    // preview`'s does) so it fills whatever width this link ends up at —
    // full-width when stacked, grown-to-fill in the row.
    <Link
      href={templateEditHref(templateId, user !== null)}
      // No `dark:` override on the ring here, deliberately: `bg-primary` is
      // already near-white in dark mode (see below), so the brighter ring
      // used on `Live preview` would sit right on top of an already-light
      // fill and disappear. The default mid-gray `ring-ring/50` reads clearly
      // against both this button's edge and the dark card behind it.
      className="group inline-flex w-full items-stretch gap-1 rounded-md outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 @sm:min-w-0 @sm:flex-1"
    >
      <span className="flex-1 rounded-md bg-primary px-5 py-3 text-center text-xs font-medium tracking-widest text-primary-foreground uppercase">
        Use this template
      </span>
      <ArrowChip className="bg-primary text-primary-foreground" />
    </Link>
  );
}

/**
 * Matches the resolved link's sizing at every width — full-width when
 * stacked, its natural compact width once the row layout kicks in at `@sm` —
 * so the action row's shape does not shift when it swaps in.
 */
export function TemplateEditButtonSkeleton() {
  return <Skeleton className="h-10 w-full rounded-md @sm:w-52" aria-hidden="true" />;
}

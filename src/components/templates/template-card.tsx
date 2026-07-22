import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
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
    <article className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md">
      {/*
        16:9 with the aspect ratio reserved up front, so the card's height is
        known before the poster paints and the grid never reflows around it.
      */}
      <div className="aspect-video w-full overflow-hidden border-b">
        <Poster />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-6">
        <h3 className="text-lg font-semibold tracking-tight">{template.name}</h3>
        <p className="text-sm text-muted-foreground">{template.description}</p>

        {/* `mt-auto` so the actions sit on the card's baseline no matter how
            long a future template's description runs. */}
        <div className="mt-auto flex flex-wrap gap-3 pt-6">
          {/*
            `nativeButton={false}` + `render` rather than a `<button>` wrapping
            a link: both actions are navigations, so they must be real anchors
            — middle-click, copy-link, and open-in-new-tab all depend on it,
            and a `<button>` announced as a button that navigates is a lie to
            assistive technology.
          */}
          {editAction}

          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            // A plain anchor, not `next/link`: this opens a new tab onto a
            // route deliberately outside the app's chrome, so there is no
            // client navigation to prefetch.
            render={
              <a
                href={templatePreviewPath(template.id)}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            Live preview
            <ExternalLink aria-hidden="true" className="size-4" />
            {/* Names the destination *and* the new tab: a link list that reads
                "Live preview" four times over is unusable, and an unannounced
                tab switch is disorienting (NFR-3). */}
            <span className="sr-only">{` of the ${template.name} template, opens in a new tab`}</span>
          </Button>
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
    <Button
      size="lg"
      nativeButton={false}
      render={<Link href={templateEditHref(templateId, user !== null)} />}
    >
      Edit
      <ArrowRight aria-hidden="true" className="size-4" />
    </Button>
  );
}

/**
 * Sized to match the resolved button exactly, so the card's action row does not
 * shift when the real one swaps in — the whole point of streaming this rather
 * than the grid was to keep the layout still.
 */
export function TemplateEditButtonSkeleton() {
  return <Skeleton className="h-10 w-24 rounded-md" aria-hidden="true" />;
}

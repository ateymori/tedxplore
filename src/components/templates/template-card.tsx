import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { templatePreviewPath } from "@/config/routes";
import { templateEditHref } from "@/lib/template-links";
import type { TemplateDefinition } from "@/templates/types";

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
  isAuthenticated,
}: {
  template: TemplateDefinition;
  /**
   * Decides only where **Edit** points, never what is *shown* — a signed-out
   * visitor sees the same card and the same affordances, and discovers the
   * account requirement at the point they act on it rather than by being told
   * up front that they cannot.
   */
  isAuthenticated: boolean;
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
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href={templateEditHref(template.id, isAuthenticated)} />}
          >
            Edit
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>

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

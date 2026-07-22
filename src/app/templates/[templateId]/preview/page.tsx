import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";

import { findTemplate, listTemplates } from "@/templates/registry";
import { demoContent } from "@/templates/contract";

/**
 * A template's Live Preview (FR-50).
 *
 * The demo content rendered through the *real* public renderer — not a
 * screenshot, not a special-cased marketing page. That is the point: what a
 * visitor sees here is exactly what the template produces, because it is the
 * same component the published site will use, fed by the same serializer
 * (`demoContent`).
 *
 * Public and unauthenticated (FR-49): a visitor can evaluate the product and
 * leave without ever creating an account.
 */

export function generateStaticParams() {
  return listTemplates().map((template) => ({ templateId: template.id }));
}

interface PageProps {
  params: Promise<{ templateId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { templateId } = await params;
  const template = findTemplate(templateId);

  if (template === null) return {};

  return {
    title: `${template.name} — live preview`,
    description: template.description,
    // The demo is a fictional event. Letting search engines index it would put
    // an invented TEDx event into results alongside real ones, and would have
    // it compete with the organizers' own published sites.
    robots: { index: false, follow: true },
  };
}

export default async function TemplatePreviewPage({ params }: PageProps) {
  const { templateId } = await params;

  // An unknown id is an ordinary outcome here — this path is reachable by hand
  // and by stale links — so `findTemplate` returns null and we 404 rather than
  // throwing (see the registry's note).
  //
  // The check is deliberately *outside* the cached component below: `notFound()`
  // works by throwing, and a throw is not a value a cache entry can hold. The
  // lookup is a synchronous registry read, so doing it twice costs nothing.
  if (findTemplate(templateId) === null) notFound();

  return <DemoRender templateId={templateId} />;
}

/**
 * Rebuilt hourly rather than frozen at build time.
 *
 * The demo seed is a function of `now` — the event date sits a fixed number of
 * days ahead precisely so the countdown never rots into the "this event has
 * taken place" state (FR-39). A permanently cached render would defeat that
 * within four months, which is what `revalidate = 3600` bought before Cache
 * Components replaced route segment configs with `use cache` + `cacheLife`.
 *
 * `new Date()` runs once per cache fill rather than once per request, and that
 * is the same bargain the old export made: an hour-stale countdown on a
 * fictional event, in exchange for not re-rendering the whole demo per visitor.
 *
 * `templateId` is passed as a plain string, not the `TemplateDefinition`:
 * arguments to a cached function form its cache key and must be serializable,
 * and the definition carries React components. The registry lookup is repeated
 * inside instead.
 */
async function DemoRender({ templateId }: { templateId: string }) {
  "use cache";
  cacheLife("hours");

  const template = findTemplate(templateId);
  if (template === null) notFound();

  const now = new Date();
  const { Renderer } = template;

  return <Renderer content={demoContent(template, now)} mode="demo" now={now} />;
}

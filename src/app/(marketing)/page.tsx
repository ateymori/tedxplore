import type { Metadata } from "next";

import { TemplateCard } from "@/components/templates/template-card";
import { SITE_DESCRIPTION, SITE_NAME } from "@/config/site";
import { getCurrentUser } from "@/server/auth-guards";
import { listTemplates } from "@/templates/registry";

/**
 * The public homepage (FR-49).
 *
 * Browsable with no account: a visitor can read what the product does, open a
 * complete working event site through Live Preview, and leave — the account is
 * only required at the point they want to edit something (FR-51).
 */
export const metadata: Metadata = {
  title: `${SITE_NAME} — ${SITE_DESCRIPTION}`,
  description: SITE_DESCRIPTION,
};

export default async function Home() {
  // Read once here rather than inside each card, and only to decide where the
  // Edit buttons point (FR-51). Nothing about the page's *content* is
  // session-dependent, so a signed-out visitor and a signed-in one see the
  // same thing. `getCurrentUser` is React-cached, so the layout's own call
  // costs nothing extra.
  const user = await getCurrentUser();
  const templates = listTemplates();

  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto w-full max-w-5xl px-6 pt-20 pb-16 sm:pt-28">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Premium TEDx event websites, generated from your content
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Fill in your speakers, venue, sponsors, and schedule. {SITE_NAME} renders a designed,
          animated, responsive site — no layout, no CSS, no templates to wrestle with.
        </p>
      </section>

      <section aria-labelledby="templates-heading" className="mx-auto w-full max-w-5xl px-6 pb-24">
        <h2 id="templates-heading" className="text-2xl font-semibold tracking-tight">
          Choose a template
        </h2>
        <p className="mt-2 text-muted-foreground">
          Preview the real thing before you sign up — every preview is a live site rendered by the
          same code your event will use.
        </p>

        {/*
          A grid from the start, though V1 registers exactly one template
          (NFR-6, roadmap item 1). `sm:grid-cols-2` with a single card leaves a
          half-width card rather than a stretched one, which is the correct
          look: a lone card blown across the full width reads as a page that is
          missing something.
        */}
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} isAuthenticated={user !== null} />
          ))}
        </div>
      </section>
    </main>
  );
}

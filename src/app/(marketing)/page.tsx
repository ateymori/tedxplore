import { Suspense } from "react";
import type { Metadata } from "next";

import { HomepageHero } from "@/components/marketing/homepage-hero";
import {
  TemplateCard,
  TemplateEditButton,
  TemplateEditButtonSkeleton,
} from "@/components/templates/template-card";
import { SITE_DESCRIPTION, SITE_NAME } from "@/config/site";
import { listTemplates } from "@/templates/registry";

/**
 * The public homepage (FR-49).
 *
 * Browsable with no account: a visitor can read what the product does, open a
 * complete working event site through Live Preview, and leave — the account is
 * only required at the point they want to edit something (FR-51).
 */

/** The one-line value proposition, shared by the tab title and the social cards. */
const HOMEPAGE_HEADLINE = `${SITE_NAME} — premium TEDx event websites from your content`;

/**
 * Homepage SEO (task 10.5).
 *
 * `title.absolute` so this does not run through the root layout's
 * `%s · Tedxplore` template — the homepage's own title already leads with the
 * brand, and the template would append a second "Tedxplore". `canonical: "/"`
 * and the Open Graph/Twitter block resolve against `metadataBase` (the root
 * layout's `APP_URL`), so a crawled preview deployment still points search and
 * social back at production. No image card: there is no honest single image for
 * "a platform that renders many different event sites", and a `summary` card
 * with a real description reads better than a stretched logo.
 */
export const metadata: Metadata = {
  title: { absolute: HOMEPAGE_HEADLINE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: HOMEPAGE_HEADLINE,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary",
    title: HOMEPAGE_HEADLINE,
    description: SITE_DESCRIPTION,
  },
};

/**
 * Synchronous, and deliberately so (task 8.0).
 *
 * Nothing about this page's *content* is session-dependent — a signed-out
 * visitor and a signed-in one see the same headline, the same cards, the same
 * copy. The only session-dependent thing is where each Edit button points
 * (FR-51), so that button is the island that streams and the rest of the page
 * prerenders. Reading the session here instead, as this page used to, would
 * make the entire marketing surface dynamic to decide one `href` per card.
 */
export default function Home() {
  const templates = listTemplates();

  return (
    <main className="flex flex-1 flex-col">
      <HomepageHero />

      <section aria-labelledby="templates-heading" className="mx-auto w-full max-w-8xl px-6 pb-24">
        <h2 id="templates-heading" className="text-2xl font-semibold tracking-tight">
          Choose your template
        </h2>
        <p className="mt-2 text-muted-foreground">
          Preview every template as a fully functional live website.
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
            <TemplateCard
              key={template.id}
              template={template}
              editAction={
                <Suspense fallback={<TemplateEditButtonSkeleton />}>
                  <TemplateEditButton templateId={template.id} />
                </Suspense>
              }
            />
          ))}
        </div>
      </section>
    </main>
  );
}

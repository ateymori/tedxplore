import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CreateEventForm } from "@/components/events/create-event-form";
import { DASHBOARD_PATH, TEMPLATE_PARAM } from "@/config/routes";
import { firstSearchParam, type SearchParams } from "@/lib/search-params";
import { requireUser } from "@/server/auth-guards";
import { DEFAULT_TEMPLATE_ID, findTemplate } from "@/templates/registry";

export const metadata: Metadata = { title: "Create event" };

/**
 * Event creation (FR-8, task 3.1).
 *
 * The template arrives as a query parameter because the homepage's Edit button
 * chooses it (FR-51) — possibly via a round trip through login, which is why
 * it travels in the URL rather than in any server-side state. An unknown or
 * missing value falls back to the default template rather than erroring: the
 * user asked to create an event, and V1 has exactly one template to give them.
 */
export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireUser();

  const requested = firstSearchParam((await searchParams)[TEMPLATE_PARAM]);
  const template =
    (requested ? findTemplate(requested) : null) ?? findTemplate(DEFAULT_TEMPLATE_ID);

  // The registry always contains the default template; this keeps the
  // non-null assertion out of the render path.
  if (template === null) throw new Error("No templates are registered.");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link
          href={DASHBOARD_PATH}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to dashboard
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Create your event site</h1>
        <p className="text-muted-foreground">
          We&rsquo;ll start you off with the {template.name} template, filled in with example
          content you can edit section by section.
        </p>
      </div>

      <CreateEventForm templateId={template.id} />
    </div>
  );
}

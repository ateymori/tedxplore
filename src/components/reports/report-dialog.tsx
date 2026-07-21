"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { REPORT_EXPLANATION_MAX_LENGTH } from "@/config/limits";
import {
  REPORT_CATEGORY_LABELS,
  REPORT_HONEYPOT_FIELD,
  reportCategorySchema,
  reportFormSchema,
  type ReportFormValues,
} from "@/lib/validation/report";

/**
 * "Report this site" (FR-45..FR-47, task 9.1).
 *
 * Rendered into the template's own footer through the `reportSlot` on
 * `TemplateRenderProps`, so it sits where a visitor would look for it while
 * the template stays a pure function of `EventContent` — see that prop's
 * comment for why the slug arrives here rather than through the content.
 *
 * ## Why this is styled for the template, not the app
 *
 * It appears on the organizer's site, inside Aurora's footer, so it uses
 * Aurora's tokens rather than shadcn's. The dialog is portalled to
 * `document.body` — outside the `.aurora` subtree — so the popup carries the
 * `aurora` class itself, exactly as the speaker dialog does; without it the
 * dialog would render as a white shadcn panel on a near-black site.
 *
 * That does couple this component to Aurora, which is a real cost worth
 * naming: a second template would want its own. The alternative — a
 * template-agnostic dialog — would look like the platform interrupting the
 * organizer's site, which is the thing the whole product is trying not to do.
 *
 * ## Caching
 *
 * Nothing here reads request data. The slug is a static prop known when the
 * page renders, so this stays inside the `use cache` entry of task 8.1 and the
 * public site remains prerendered; the submission goes to a Route Handler
 * (task 9.2), which is uncached by construction.
 */
export function ReportDialog({ slug }: { slug: string }) {
  const [submitted, setSubmitted] = useState(false);

  const emptyForm: ReportFormValues = {
    slug,
    category: "IMPERSONATION",
    explanation: "",
    reporterEmail: "",
    [REPORT_HONEYPOT_FIELD]: "",
  };

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: emptyForm,
  });

  const {
    formState: { errors, isSubmitting },
  } = form;

  async function onSubmit(values: ReportFormValues) {
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (response.ok) {
      setSubmitted(true);
      return;
    }

    // 429 is the rate limit (BR-15) and is the one failure worth naming
    // precisely — "try again" is wrong advice when the answer is "not for an
    // hour". Everything else collapses to one message: a stranger doing us a
    // favour does not need our status codes.
    form.setError("root", {
      message:
        response.status === 429
          ? "You've sent several reports about this site already. Please give us time to look at those first."
          : "Something went wrong sending that. Please try again in a moment.",
    });
  }

  return (
    <Dialog.Root
      onOpenChange={(open) => {
        // Reset on close so reopening does not show the previous submission's
        // confirmation or a stale error.
        if (!open) {
          setSubmitted(false);
          form.reset(emptyForm);
        }
      }}
    >
      <Dialog.Trigger className="text-aurora-fog/70 hover:text-aurora-fog cursor-pointer text-xs underline underline-offset-4 transition-colors">
        Report this site
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm" />
        <Dialog.Popup className="aurora data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 border-aurora-line bg-aurora-ink fixed top-1/2 left-1/2 z-[60] max-h-[85svh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border p-6 outline-none sm:p-8">
          <Dialog.Close
            aria-label="Close"
            className="text-aurora-fog hover:text-aurora-snow absolute top-4 right-4 inline-flex size-9 items-center justify-center rounded-full transition-colors"
          >
            <X className="size-4" />
          </Dialog.Close>

          {submitted ? (
            <>
              <Dialog.Title className="text-aurora-h3 text-aurora-snow pr-10">
                Thank you
              </Dialog.Title>
              <Dialog.Description className="text-aurora-fog mt-4 leading-relaxed">
                Your report has been sent to the Tedxplore team. We review every one. We won&rsquo;t
                share your details with the organizers of this site.
              </Dialog.Description>
              <Dialog.Close className="bg-aurora-red hover:bg-aurora-red-deep text-aurora-snow mt-8 inline-flex h-11 cursor-pointer items-center justify-center rounded-full px-6 text-sm font-semibold transition-colors">
                Close
              </Dialog.Close>
            </>
          ) : (
            <>
              <Dialog.Title className="text-aurora-h3 text-aurora-snow pr-10">
                Report this site
              </Dialog.Title>
              <Dialog.Description className="text-aurora-fog mt-2 text-sm leading-relaxed">
                Tell the Tedxplore team what&rsquo;s wrong. This goes to us, not to the organizers
                of this event.
              </Dialog.Description>

              <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-5">
                <div>
                  <label
                    htmlFor="report-category"
                    className="text-aurora-snow block text-sm font-medium"
                  >
                    What&rsquo;s the problem?
                  </label>
                  <select
                    id="report-category"
                    {...form.register("category")}
                    className="border-aurora-line bg-aurora-void text-aurora-snow focus:border-aurora-fog mt-2 h-11 w-full rounded-lg border px-3 text-sm outline-none"
                  >
                    {reportCategorySchema.options.map((category) => (
                      <option key={category} value={category}>
                        {REPORT_CATEGORY_LABELS[category]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="report-explanation"
                    className="text-aurora-snow block text-sm font-medium"
                  >
                    What should we know?
                  </label>
                  <textarea
                    id="report-explanation"
                    rows={5}
                    maxLength={REPORT_EXPLANATION_MAX_LENGTH}
                    {...form.register("explanation")}
                    aria-invalid={errors.explanation ? true : undefined}
                    className="border-aurora-line bg-aurora-void text-aurora-snow focus:border-aurora-fog mt-2 w-full resize-y rounded-lg border p-3 text-sm outline-none"
                  />
                  {errors.explanation ? (
                    <p role="alert" className="text-aurora-ember mt-2 text-sm">
                      {errors.explanation.message}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label
                    htmlFor="report-email"
                    className="text-aurora-snow block text-sm font-medium"
                  >
                    Your email <span className="text-aurora-fog font-normal">(optional)</span>
                  </label>
                  <p className="text-aurora-fog/70 mt-1 text-xs">
                    Only if you&rsquo;re happy for us to follow up. You don&rsquo;t need to leave
                    one.
                  </p>
                  <input
                    id="report-email"
                    type="email"
                    {...form.register("reporterEmail")}
                    aria-invalid={errors.reporterEmail ? true : undefined}
                    className="border-aurora-line bg-aurora-void text-aurora-snow focus:border-aurora-fog mt-2 h-11 w-full rounded-lg border px-3 text-sm outline-none"
                  />
                  {errors.reporterEmail ? (
                    <p role="alert" className="text-aurora-ember mt-2 text-sm">
                      {errors.reporterEmail.message}
                    </p>
                  ) : null}
                </div>

                {/*
                  The honeypot (FR-47). Hidden from people three ways —
                  off-screen, `aria-hidden`, and out of the tab order — so a
                  screen-reader user is never asked to fill in a field that
                  does not exist, while a bot completing every input it finds
                  fills it and is discarded server-side.

                  `autoComplete="off"` matters here: a browser autofilling a
                  field called "website" would silently flag a real person.
                */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label htmlFor="report-website">Website</label>
                  <input
                    id="report-website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    {...form.register(REPORT_HONEYPOT_FIELD)}
                  />
                </div>

                {errors.root ? (
                  <p role="alert" className="text-aurora-ember text-sm">
                    {errors.root.message}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-aurora-red hover:bg-aurora-red-deep text-aurora-snow inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-full px-6 text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {isSubmitting ? "Sending…" : "Send report"}
                </button>
              </form>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

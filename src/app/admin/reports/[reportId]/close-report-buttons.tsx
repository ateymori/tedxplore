"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { closeReportAction } from "@/app/admin/actions";

/**
 * Resolve / dismiss (task 9.3).
 *
 * Two buttons, no confirmation dialog. The Phase 7 rule applies — a dialog
 * belongs where there is something to *write*, not merely something to
 * confirm — and both of these are reversible in the only sense that matters:
 * neither changes what a visitor sees. The heavy, visitor-facing action
 * (suspend) lives on the event page behind its own dialog.
 *
 * "Resolved" and "Dismissed" are deliberately not collapsed into one "Close"
 * button. They record opposite conclusions about the site, which is what lets
 * a later admin tell a repeat offender from a repeatedly-reported innocent.
 */
export function CloseReportButtons({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<"RESOLVED" | "DISMISSED" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function close(status: "RESOLVED" | "DISMISSED") {
    setPending(status);
    setError(null);

    const result = await closeReportAction(reportId, status);

    if (!result.ok) {
      setPending(null);
      // The realistic failure is another admin closing it first, which the
      // service reports as INVALID_STATE rather than silently overwriting.
      setError(
        result.error.type === "INVALID_STATE"
          ? "Someone else already closed this report. Refresh to see their decision."
          : "That didn't work. Please try again.",
      );
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => close("RESOLVED")} disabled={pending !== null}>
          {pending === "RESOLVED" ? "Marking…" : "Mark resolved"}
        </Button>
        <Button variant="outline" onClick={() => close("DISMISSED")} disabled={pending !== null}>
          {pending === "DISMISSED" ? "Dismissing…" : "Dismiss"}
        </Button>
      </div>

      {error !== null ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Resolved means you acted on it. Dismissed means there was nothing to act on. Neither takes
        the site offline — use Suspend on the event for that.
      </p>
    </div>
  );
}

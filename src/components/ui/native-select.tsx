import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A native `<select>`, styled to match `Input`.
 *
 * Deliberately not shadcn's `Select` (a Base UI listbox), for two reasons that
 * both come from the editor's actual selects:
 *
 *   • The timezone field offers every IANA zone — roughly 400 options. A
 *     custom listbox renders all of them into the DOM and reimplements
 *     type-to-search; the native control virtualizes, gets platform search for
 *     free, and opens as a proper wheel picker on iOS and Android.
 *   • A native select works with React Hook Form's `register` directly, while
 *     a listbox needs a `Controller` per field. Across timezone, sponsor tier,
 *     and every social-link platform row, that is a lot of plumbing to buy
 *     nothing the user can see.
 *
 * The chevron is decorative and drawn on top, with `appearance-none` removing
 * the platform's own — `pointer-events-none` on the wrapper's icon keeps the
 * whole control clickable.
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative w-full">
      <select
        data-slot="native-select"
        className={cn(
          "h-8 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export { NativeSelect };

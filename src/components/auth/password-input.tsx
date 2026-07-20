"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Password field with a reveal toggle.
 *
 * The toggle is why none of the auth forms ask the user to type their password
 * twice: it solves the same "did I typo the thing I can't see" problem without
 * a second field, and it works on the reset form where a typo would otherwise
 * lock someone out of the account they are in the middle of recovering.
 */
export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [revealed, setRevealed] = useState(false);
  const labelId = useId();

  return (
    <div className="relative">
      <Input {...props} type={revealed ? "text" : "password"} className={cn("pr-10", className)} />
      <button
        type="button"
        onClick={() => setRevealed((value) => !value)}
        // A submit-triggering Enter on this control would be surprising; it is
        // reachable by keyboard but stays out of the primary tab flow.
        tabIndex={-1}
        aria-pressed={revealed}
        aria-label={revealed ? "Hide password" : "Show password"}
        id={labelId}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {revealed ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

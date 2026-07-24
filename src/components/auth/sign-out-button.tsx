"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { HOME_PATH } from "@/config/routes";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth-client";

/**
 * Signing out.
 *
 * Better Auth returns failures as a value rather than throwing, so the result
 * has to be checked. An earlier version navigated unconditionally, which made a
 * *failed* sign-out indistinguishable from a successful one: the user landed on
 * the homepage still holding a valid session, with the nav showing them signed
 * in and no explanation. That is the worst possible failure for this particular
 * button — someone on a shared machine has every reason to believe they are
 * signed out when they are not.
 *
 * Lives in the nav bar itself, not the profile dropdown — sign-out is
 * high-frequency and needs to be immediately visible, unlike a settled-later
 * action such as Settings, which belongs behind the avatar.
 *
 * (Found for real: serving the app on a port other than the one in
 * `NEXT_PUBLIC_APP_URL` makes Better Auth reject every auth mutation as
 * `INVALID_ORIGIN`, and this button reported success anyway.)
 */
export function SignOutButton({
  className,
  buttonClassName,
}: {
  /** Merged onto the outer wrapper — e.g. `"w-full"` for a full-width row. */
  className?: string;
  /** Merged onto the `Button` itself, overriding the default size/shape. */
  buttonClassName?: string;
} = {}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    setPending(true);
    setFailed(false);

    const { error } = await signOut();

    if (error) {
      // Stay put. Navigating away would hide the fact that the session is still
      // live, which is the whole bug this guards against.
      setPending(false);
      setFailed(true);
      return;
    }

    // `refresh` discards the router cache as well as re-rendering: without it,
    // a cached authenticated page can be shown by a back navigation.
    router.push(HOME_PATH);
    router.refresh();
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {failed ? (
        // `role="alert"` so a screen reader announces it — the visual change is
        // small and easy to miss next to a button that still says "Sign out".
        <span
          role="alert"
          className="rounded-full border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
        >
          Sign out failed
        </span>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={pending}
        className={cn(
          "group/signout h-9 cursor-pointer rounded-sm border-border/60 bg-background/60 text-muted-foreground shadow-sm transition-all duration-150 ease-out",
          "hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive hover:shadow-lg hover:shadow-destructive/15",
          failed && "border-destructive/30 text-destructive",
          buttonClassName,
        )}
      >
        {pending ? (
          <Spinner />
        ) : (
          <LogOut className="transition-transform duration-150 ease-out group-hover/signout:translate-x-0.5" />
        )}
        {pending ? "Signing out…" : failed ? "Try again" : "Sign out"}
      </Button>
    </div>
  );
}

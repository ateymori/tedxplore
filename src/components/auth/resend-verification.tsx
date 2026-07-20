"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type State = "idle" | "sending" | "sent" | "failed";

/**
 * Resends the verification email.
 *
 * Deliberately reports success even when the address has no account: the reply
 * would otherwise tell an anonymous visitor whether a given email is registered
 * here, which is exactly the enumeration leak the rest of the flow avoids.
 */
export function ResendVerification({ email, callbackURL }: { email: string; callbackURL: string }) {
  const [state, setState] = useState<State>("idle");

  async function handleClick() {
    setState("sending");
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL });
    setState(error ? "failed" : "sent");
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleClick}
        disabled={state === "sending" || state === "sent"}
      >
        {state === "sending"
          ? "Sending…"
          : state === "sent"
            ? "Email sent"
            : "Resend verification email"}
      </Button>

      {state === "sent" ? (
        <p className="text-center text-sm text-muted-foreground">
          Sent again to {email}. It can take a minute to arrive.
        </p>
      ) : null}

      {state === "failed" ? (
        <p className="text-center text-sm text-destructive">
          We couldn&apos;t send that right now. Please try again shortly.
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";

/**
 * Google sign-in.
 *
 * Rendered only when the server reports the provider is configured — the pages
 * read `isGoogleOAuthConfigured` and pass it down, so the button can never
 * appear without a provider behind it.
 *
 * `callbackURL` is the already-sanitized `returnTo`; Better Auth appends it to
 * the OAuth state and redirects there once the callback completes.
 */
export function GoogleButton({
  callbackURL,
  onError,
}: {
  callbackURL: string;
  onError: (message: string) => void;
}) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const { error } = await signIn.social({ provider: "google", callbackURL });

    // On success the browser is already navigating away, so there is nothing
    // to reset — only a failure returns here.
    if (error) {
      setPending(false);
      onError(error.message ?? "Could not start Google sign-in. Please try again.");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={handleClick}
      disabled={pending}
    >
      <GoogleLogo />
      {pending ? "Redirecting…" : "Continue with Google"}
    </Button>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

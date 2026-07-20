"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { HOME_PATH } from "@/config/routes";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await signOut();

    // `refresh` discards the router cache as well as re-rendering: without it,
    // a cached authenticated page can be shown by a back navigation.
    router.push(HOME_PATH);
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={pending}>
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}

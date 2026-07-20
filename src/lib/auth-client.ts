// Browser-side auth client.
//
// Safe to import from Client Components: `better-auth/react` ships no server
// code, and the `typeof auth` import below is type-only, so the server instance
// (and its `server-only` guard) is erased at compile time.

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@/server/auth";

export const authClient = createAuthClient({
  // Teaches the client about `user.role` so it is typed here exactly as it is
  // declared on the server, with no second declaration to keep in sync.
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  // Named `forgetPassword` in older Better Auth releases; 1.6 removed that alias.
  requestPasswordReset,
  resetPassword,
} = authClient;

// Better Auth's entire HTTP surface: sign-in/up, sign-out, email verification,
// password reset, and the Google OAuth callback all mount under /api/auth.
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";

export const { GET, POST } = toNextJsHandler(auth);

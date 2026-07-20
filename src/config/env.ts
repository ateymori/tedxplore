// Server-side environment variables, validated once at module load.
//
// Two categories, deliberately treated differently:
//
//   • Required — the app cannot serve a request without them. Missing values
//     fail loudly at startup rather than at the first login attempt.
//   • Optional integrations — services not yet provisioned (Google OAuth,
//     Resend). The app degrades in a defined way instead of refusing to boot:
//     Google sign-in is simply not offered, and emails are logged to the
//     console. This keeps local dev and CI runnable before the accounts exist,
//     while `assertProductionIntegrations` (called from `auth.ts`) still
//     refuses to let a real production deployment run without them.
//
// This module is server-only. Anything the browser needs must be a
// `NEXT_PUBLIC_` variable read from `config/site.ts` instead.

import "server-only";
import { z } from "zod";

const serverEnvSchema = z
  .object({
    // Signs session cookies and verification/reset tokens. 32 chars is Better
    // Auth's own floor; generate with `openssl rand -base64 32`.
    BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),

    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

    RESEND_API_KEY: z.string().min(1).optional(),
    // Full RFC 5322 form, e.g. `Tedxplore <no-reply@tedxplore.com>`.
    EMAIL_FROM: z.string().min(1).optional(),
  })
  .refine((env) => Boolean(env.GOOGLE_CLIENT_ID) === Boolean(env.GOOGLE_CLIENT_SECRET), {
    error:
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together (or both left unset to disable Google sign-in)",
    path: ["GOOGLE_CLIENT_ID"],
  })
  .refine((env) => !env.RESEND_API_KEY || Boolean(env.EMAIL_FROM), {
    error: "EMAIL_FROM is required whenever RESEND_API_KEY is set",
    path: ["EMAIL_FROM"],
  });

function loadServerEnv() {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    // Never interpolate the values themselves — this message reaches logs.
    const details = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");

    throw new Error(`Invalid server environment variables:\n${details}`);
  }

  return parsed.data;
}

export const serverEnv = loadServerEnv();

/** Google sign-in is offered only when both credentials are configured. */
export const isGoogleOAuthConfigured =
  serverEnv.GOOGLE_CLIENT_ID !== undefined && serverEnv.GOOGLE_CLIENT_SECRET !== undefined;

/** Without Resend, the email adapter falls back to its console transport. */
export const isEmailConfigured = serverEnv.RESEND_API_KEY !== undefined;

/**
 * Guards against shipping the degraded modes to production by accident.
 *
 * Deliberately *not* run at build time: `next build` executes module scope with
 * `NODE_ENV=production` but without the deployment's runtime secrets, so a
 * module-load check here would break every CI build. Call it from request-time
 * code paths only.
 */
export function assertProductionIntegrations(): void {
  if (process.env.NODE_ENV !== "production") return;

  const missing: string[] = [];
  if (!isEmailConfigured) missing.push("RESEND_API_KEY");

  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }
}

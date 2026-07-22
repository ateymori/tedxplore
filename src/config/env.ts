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

    // Cloudinary (FR-20..FR-23). Optional for the same reason as the two
    // above: the app must stay runnable before the account exists. Unset means
    // uploads are refused with a clear message and every image slot renders its
    // FR-38 fallback — the cloud name is read separately, from
    // `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, because the browser builds delivery
    // URLs and so must see it too.
    CLOUDINARY_API_KEY: z.string().min(1).optional(),
    CLOUDINARY_API_SECRET: z.string().min(1).optional(),

    // Shared secret for the Vercel Cron sweep endpoint (task 10.4). Vercel
    // sends it as `Authorization: Bearer <CRON_SECRET>` on scheduled
    // invocations. Optional so dev and CI run without it; when unset the sweep
    // route refuses every request in production (fail-closed) and allows local
    // calls in development — see `app/api/cron/sweep/route.ts`.
    CRON_SECRET: z.string().min(1).optional(),
  })
  .refine((env) => Boolean(env.GOOGLE_CLIENT_ID) === Boolean(env.GOOGLE_CLIENT_SECRET), {
    error:
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together (or both left unset to disable Google sign-in)",
    path: ["GOOGLE_CLIENT_ID"],
  })
  .refine((env) => !env.RESEND_API_KEY || Boolean(env.EMAIL_FROM), {
    error: "EMAIL_FROM is required whenever RESEND_API_KEY is set",
    path: ["EMAIL_FROM"],
  })
  .refine((env) => Boolean(env.CLOUDINARY_API_KEY) === Boolean(env.CLOUDINARY_API_SECRET), {
    error:
      "CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set together (or both left unset to disable uploads)",
    path: ["CLOUDINARY_API_KEY"],
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
 * Uploads need all three values: the two secrets to sign a request, and the
 * cloud name to address it. The cloud name is `NEXT_PUBLIC_` and therefore
 * lives in `config/site.ts`'s half of the world, but the *decision* about
 * whether uploading is possible belongs here, next to the other integrations.
 */
export const isCloudinaryConfigured =
  serverEnv.CLOUDINARY_API_KEY !== undefined &&
  serverEnv.CLOUDINARY_API_SECRET !== undefined &&
  Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);

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
  // A production deployment where organizers cannot add a single image is not
  // a degraded mode worth allowing.
  if (!isCloudinaryConfigured)
    missing.push("CLOUDINARY_API_KEY / NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME");

  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }
}

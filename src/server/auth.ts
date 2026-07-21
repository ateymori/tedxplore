// Better Auth server instance — the single source of session truth.
//
// Nothing outside this file constructs auth state. Route handlers and Server
// Actions read sessions through `src/server/auth-guards.ts`, which wraps this.

import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import {
  EMAIL_VERIFICATION_TTL_SECONDS,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RESET_TTL_SECONDS,
} from "@/config/limits";
import { assertProductionIntegrations, serverEnv } from "@/config/env";
import { APP_URL } from "@/config/site";
import { prisma } from "@/server/repositories/prisma";
import { sendEmail } from "@/server/adapters/email";
import { ResetPasswordEmail } from "@/emails/reset-password";
import { VerifyEmail } from "@/emails/verify-email";

const hours = (seconds: number) => Math.round(seconds / 3600);

// Destructured through locals so TypeScript narrows both credentials to
// `string` — `isGoogleOAuthConfigured` alone wouldn't narrow the env object.
const { GOOGLE_CLIENT_ID: googleClientId, GOOGLE_CLIENT_SECRET: googleClientSecret } = serverEnv;

const googleProvider =
  googleClientId !== undefined && googleClientSecret !== undefined
    ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
    : {};

export const auth = betterAuth({
  baseURL: APP_URL,
  secret: serverEnv.BETTER_AUTH_SECRET,

  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    // FR-3: an unverified account cannot hold a session at all, so every
    // authenticated surface can assume a verified email without re-checking.
    requireEmailVerification: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    resetPasswordTokenExpiresIn: PASSWORD_RESET_TTL_SECONDS,
    // A password reset is a plausible response to "someone else is in my
    // account", which is only true if it actually evicts them.
    revokeSessionsOnPasswordReset: true,

    sendResetPassword: async ({ user, url }) => {
      assertProductionIntegrations();
      await sendEmail({
        to: user.email,
        subject: "Reset your Tedxplore password",
        react: ResetPasswordEmail({
          name: user.name || null,
          resetUrl: url,
          expiresInHours: hours(PASSWORD_RESET_TTL_SECONDS),
        }),
      });
    },
  },

  emailVerification: {
    expiresIn: EMAIL_VERIFICATION_TTL_SECONDS,
    sendOnSignUp: true,
    // Verifying is proof of both intent and mailbox ownership; making the user
    // then type the password they just chose adds nothing.
    autoSignInAfterVerification: true,

    sendVerificationEmail: async ({ user, url }) => {
      assertProductionIntegrations();
      await sendEmail({
        to: user.email,
        subject: "Confirm your Tedxplore email address",
        react: VerifyEmail({
          name: user.name || null,
          verifyUrl: url,
          expiresInHours: hours(EMAIL_VERIFICATION_TTL_SECONDS),
        }),
      });
    },
  },

  // Registered only when credentials exist, so a missing Google app degrades
  // to email/password rather than a runtime error on the sign-in page. The
  // auth pages read `isGoogleOAuthConfigured` server-side and pass it down, so
  // the button and the provider can't disagree.
  socialProviders: googleProvider,

  account: {
    accountLinking: {
      enabled: true,
      // Google asserts a verified email, so linking by address can't be used
      // to take over an existing password account.
      trustedProviders: ["google"],
    },
  },

  /**
   * Rate limiting the auth surface (task 9.4).
   *
   * Better Auth's own rate limiter rather than our `RateLimiter` adapter,
   * chosen deliberately: it already knows every auth path and its semantics, so
   * tightening the brute-forceable ones is a table of `customRules` rather than
   * hand-parsing the `/api/auth/[...all]` catch-all and re-deriving what a
   * "sign-in attempt" is. Our adapter still owns the two app-level surfaces it
   * fits — report submission (9.2) and preview-token guessing (9.4).
   *
   * `storage: "database"` because the target is Vercel Fluid Compute: an
   * in-memory counter (Better Auth's default) is per-instance, so it would
   * reset on cold starts and split across concurrent instances — useless as a
   * brute-force bound. This needs the `RateLimit` model in the Prisma schema.
   *
   * `enabled: true` forces it on in development too (Better Auth otherwise
   * limits only in production), so the limits are exercised by the same code
   * path that runs in prod and can be verified locally. The default window is
   * deliberately loose; the `customRules` are where the security lives:
   *
   *   - sign-in:         5 / minute — stops password spraying without
   *                      punishing a fat-fingered real user.
   *   - sign-up:         5 / hour   — account-creation floods are the abuse.
   *   - password reset:  3 / hour   — each attempt sends an email, so this
   *                      also bounds using us as an email cannon at an address.
   */
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60 * 60, max: 5 },
      "/forget-password": { window: 60 * 60, max: 3 },
      "/reset-password": { window: 60 * 60, max: 5 },
    },
    storage: "database",
    modelName: "rateLimit",
  },

  user: {
    additionalFields: {
      // Mirrors the `UserRole` Prisma enum. `input: false` is load-bearing:
      // without it the role is a client-settable field on sign-up, and anyone
      // could register as an admin.
      role: {
        type: ["USER", "ADMIN"],
        required: false,
        defaultValue: "USER",
        input: false,
      },
    },
  },

  // Must stay last — it wraps the handler to flush Set-Cookie from Server
  // Actions, and plugins registered after it would not be wrapped.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];

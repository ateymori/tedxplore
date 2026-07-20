// Validation for the authentication forms.
//
// Client-side use is UX only (architectural invariant 6) — Better Auth
// re-validates everything server-side, using the same bounds from
// `config/limits.ts`. These schemas exist so the user hears about a problem
// before a round trip, and hears it in the same words either way.

import { z } from "zod";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, USER_NAME_MAX_LENGTH } from "@/config/limits";

/**
 * Normalizes before validating: addresses are compared case-insensitively
 * everywhere downstream (the `user.email` unique index included), so `Ada@x.com`
 * and `ada@x.com` must not be able to become two accounts.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address." }))
  // 254 is the practical RFC 5321 ceiling for a whole address.
  .pipe(z.string().max(254, { error: "That email address is too long." }));

/**
 * No composition rules (no "must contain a symbol"). Current NIST guidance is
 * that they push users toward predictable substitutions and password reuse;
 * length is the property that matters.
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, {
    error: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
  })
  .max(PASSWORD_MAX_LENGTH, {
    error: `Use at most ${PASSWORD_MAX_LENGTH} characters.`,
  });

export const userNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Enter your name." })
  .max(USER_NAME_MAX_LENGTH, {
    error: `Use at most ${USER_NAME_MAX_LENGTH} characters.`,
  });

export const signUpSchema = z.object({
  name: userNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  // Deliberately not `passwordSchema`: an existing password may predate a
  // future bound change, and telling someone their *correct* password is
  // "too short" at sign-in is nonsense.
  password: z.string().min(1, { error: "Enter your password." }),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

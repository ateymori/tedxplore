"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AuthCard } from "@/components/auth/auth-card";
import { GoogleButton } from "@/components/auth/google-button";
import { PasswordInput } from "@/components/auth/password-input";
import { FORGOT_PASSWORD_PATH, SIGNUP_PATH, VERIFY_EMAIL_PATH } from "@/config/routes";
import { signIn } from "@/lib/auth-client";
import { withReturnTo } from "@/lib/return-to";
import { signInSchema } from "@/lib/validation/auth";

export function LoginForm({
  returnTo,
  googleEnabled,
}: {
  /** Already sanitized server-side; safe to navigate to. */
  returnTo: string;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  // Set once a sign-in succeeds. `isSubmitting` flips back to false the moment
  // the handler resolves, which would briefly re-enable the button while the
  // navigation is still in flight.
  const [navigating, setNavigating] = useState(false);

  const form = useForm({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const { errors, isSubmitting } = form.formState;
  const pending = isSubmitting || navigating;

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await signIn.email({
      email: values.email,
      password: values.password,
      callbackURL: returnTo,
    });

    if (!error) {
      setNavigating(true);
      // `callbackURL` governs the OAuth flow; an email sign-in resolves here,
      // so the navigation is ours to perform.
      router.push(returnTo);
      router.refresh();
      return;
    }

    // Better Auth refuses the session and re-sends the verification email when
    // the address was never confirmed (FR-3). Say so, rather than showing the
    // generic "wrong password" message the status code would otherwise imply.
    if (error.code === "EMAIL_NOT_VERIFIED") {
      setNavigating(true);
      router.push(`${VERIFY_EMAIL_PATH}?email=${encodeURIComponent(values.email)}`);
      return;
    }

    form.setError("root", {
      message:
        error.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "That email and password don't match an account."
          : (error.message ?? "Something went wrong. Please try again."),
    });
  });

  return (
    <AuthCard
      title="Sign in"
      description="Welcome back. Sign in to manage your event sites."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href={withReturnTo(SIGNUP_PATH, returnTo)}
            className="font-medium text-foreground underline underline-offset-4"
          >
            Sign up
          </Link>
        </>
      }
    >
      {errors.root ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{errors.root.message}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field data-invalid={Boolean(errors.email) || undefined}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...form.register("email")}
          />
          {errors.email ? (
            <FieldError id="email-error">{errors.email.message}</FieldError>
          ) : null}
        </Field>

        <Field data-invalid={Boolean(errors.password) || undefined}>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link
              href={FORGOT_PASSWORD_PATH}
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...form.register("password")}
          />
          {errors.password ? (
            <FieldError id="password-error">{errors.password.message}</FieldError>
          ) : null}
        </Field>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {googleEnabled ? (
        <>
          <FieldSeparator>or</FieldSeparator>
          <GoogleButton
            callbackURL={returnTo}
            onError={(message) => form.setError("root", { message })}
          />
        </>
      ) : null}
    </AuthCard>
  );
}

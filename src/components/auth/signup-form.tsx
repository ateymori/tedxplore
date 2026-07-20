"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AuthCard } from "@/components/auth/auth-card";
import { GoogleButton } from "@/components/auth/google-button";
import { PasswordInput } from "@/components/auth/password-input";
import { LOGIN_PATH, RETURN_TO_PARAM, VERIFY_EMAIL_PATH } from "@/config/routes";
import { PASSWORD_MIN_LENGTH } from "@/config/limits";
import { signUp } from "@/lib/auth-client";
import { withReturnTo } from "@/lib/return-to";
import { signUpSchema } from "@/lib/validation/auth";

export function SignupForm({
  returnTo,
  googleEnabled,
}: {
  returnTo: string;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);

  const form = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const { errors, isSubmitting } = form.formState;
  const pending = isSubmitting || navigating;

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
      callbackURL: returnTo,
    });

    if (error) {
      form.setError("root", {
        message: error.message ?? "Something went wrong. Please try again.",
      });
      return;
    }

    setNavigating(true);
    // No session is created yet — `requireEmailVerification` means the account
    // is inert until the emailed link is followed (FR-3). Send the user to the
    // "check your inbox" page rather than a dashboard they can't reach.
    router.push(
      `${VERIFY_EMAIL_PATH}?email=${encodeURIComponent(values.email)}` +
        `&${RETURN_TO_PARAM}=${encodeURIComponent(returnTo)}`,
    );
  });

  return (
    <AuthCard
      title="Create your account"
      description="Build a premium TEDx-style event site from your event details."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href={withReturnTo(LOGIN_PATH, returnTo)}
            className="font-medium text-foreground underline underline-offset-4"
          >
            Sign in
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
        <Field data-invalid={Boolean(errors.name) || undefined}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
            {...form.register("name")}
          />
          {errors.name ? (
            <FieldError id="name-error">{errors.name.message}</FieldError>
          ) : null}
        </Field>

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
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password ? "password-error" : "password-description"
            }
            {...form.register("password")}
          />
          {errors.password ? (
            <FieldError id="password-error">{errors.password.message}</FieldError>
          ) : (
            <FieldDescription id="password-description">
              At least {PASSWORD_MIN_LENGTH} characters.
            </FieldDescription>
          )}
        </Field>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
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

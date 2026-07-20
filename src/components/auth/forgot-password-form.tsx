"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, MailCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AuthCard } from "@/components/auth/auth-card";
import { LOGIN_PATH, RESET_PASSWORD_PATH } from "@/config/routes";
import { requestPasswordReset } from "@/lib/auth-client";
import { forgotPasswordSchema } from "@/lib/validation/auth";

export function ForgotPasswordForm() {
  const form = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const { errors, isSubmitting, isSubmitSuccessful } = form.formState;

  // `isSubmitSuccessful` alone isn't enough — it is true whenever the handler
  // resolves, including when it recorded a root error.
  const sent = isSubmitSuccessful && !errors.root;

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await requestPasswordReset({
      email: values.email,
      // Where the emailed link lands after the token is validated. Better Auth
      // appends the token to this path for the reset form to consume.
      redirectTo: RESET_PASSWORD_PATH,
    });

    if (error) {
      form.setError("root", {
        message: error.message ?? "Something went wrong. Please try again.",
      });
    }
  });

  if (sent) {
    return (
      <AuthCard
        title="Check your email"
        description="If an account exists for that address, we've sent a link to reset your password. It expires in an hour."
        footer={
          <Link
            href={LOGIN_PATH}
            className="font-medium text-foreground underline underline-offset-4"
          >
            Back to sign in
          </Link>
        }
      >
        <Alert>
          <MailCheck />
          <AlertDescription>
            Didn&apos;t get it? Check your spam folder, then try again in a few minutes.
          </AlertDescription>
        </Alert>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we'll send you a link to choose a new password."
      footer={
        <Link
          href={LOGIN_PATH}
          className="font-medium text-foreground underline underline-offset-4"
        >
          Back to sign in
        </Link>
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
          {errors.email ? <FieldError id="email-error">{errors.email.message}</FieldError> : null}
        </Field>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthCard>
  );
}

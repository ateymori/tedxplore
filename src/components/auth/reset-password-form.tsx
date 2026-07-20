"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { AuthCard } from "@/components/auth/auth-card";
import { PasswordInput } from "@/components/auth/password-input";
import { FORGOT_PASSWORD_PATH, LOGIN_PATH } from "@/config/routes";
import { PASSWORD_MIN_LENGTH } from "@/config/limits";
import { resetPassword } from "@/lib/auth-client";
import { resetPasswordSchema } from "@/lib/validation/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);

  const form = useForm({
    resolver: zodResolver(resetPasswordSchema),
    // The token rides along as a registered field so the schema validates the
    // whole payload, but it is never rendered as an input.
    defaultValues: { token, password: "" },
  });

  const { errors, isSubmitting } = form.formState;
  const pending = isSubmitting || navigating;

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await resetPassword({
      token: values.token,
      newPassword: values.password,
    });

    if (error) {
      form.setError("root", {
        message: error.message ?? "Something went wrong. Please try again.",
      });
      return;
    }

    setNavigating(true);
    // `revokeSessionsOnPasswordReset` means no session survives this, including
    // any the attacker held — so the user signs in again with the new password.
    router.push(`${LOGIN_PATH}?reset=1`);
  });

  return (
    <AuthCard
      title="Choose a new password"
      description="Pick something you don't use anywhere else."
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
          <AlertDescription>
            {errors.root.message}{" "}
            <Link href={FORGOT_PASSWORD_PATH} className="underline underline-offset-4">
              Request a new link
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <input type="hidden" {...form.register("token")} />

        <Field data-invalid={Boolean(errors.password) || undefined}>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            autoFocus
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : "password-description"}
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
          {pending ? "Saving…" : "Set new password"}
        </Button>
      </form>
    </AuthCard>
  );
}

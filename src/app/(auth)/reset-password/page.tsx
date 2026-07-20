import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { FORGOT_PASSWORD_PATH, LOGIN_PATH } from "@/config/routes";
import { firstSearchParam, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const token = firstSearchParam(params.token);

  // Better Auth validates the token at `/api/auth/reset-password/:token` and
  // redirects here — with `?token=…` when it holds up, or `?error=…` when it
  // has expired or been used. A bare visit with neither is someone who typed
  // the URL; all three land on the same "get a fresh link" dead end.
  if (!token) {
    const expired = firstSearchParam(params.error) === "INVALID_TOKEN";

    return (
      <AuthCard
        title="This link isn't valid"
        description={
          expired
            ? "Password reset links expire after an hour and can only be used once."
            : "We couldn't read a reset token from that link."
        }
        footer={
          <Link
            href={LOGIN_PATH}
            className="font-medium text-foreground underline underline-offset-4"
          >
            Back to sign in
          </Link>
        }
      >
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>
            <Link href={FORGOT_PASSWORD_PATH} className="font-medium underline underline-offset-4">
              Request a new reset link
            </Link>{" "}
            to continue.
          </AlertDescription>
        </Alert>
      </AuthCard>
    );
  }

  return <ResetPasswordForm token={token} />;
}

import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, MailCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthCard } from "@/components/auth/auth-card";
import { ResendVerification } from "@/components/auth/resend-verification";
import { LOGIN_PATH, RETURN_TO_PARAM } from "@/config/routes";
import { resolveReturnTo } from "@/lib/return-to";
import { firstSearchParam, type SearchParams } from "@/lib/search-params";
import { emailSchema } from "@/lib/validation/auth";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
};

/**
 * The waiting room between sign-up and a usable account (FR-3).
 *
 * A *successful* verification never lands here — Better Auth redirects straight
 * to the `callbackURL`. This page covers the two states where the user is still
 * stuck: freshly signed up, or bounced back with an expired link.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const returnTo = resolveReturnTo(firstSearchParam(params[RETURN_TO_PARAM]));
  const failed = firstSearchParam(params.error) !== undefined;

  // The address arrives in a query string, so it is untrusted input — it is
  // echoed back into the page and handed to the resend endpoint. Anything that
  // isn't a well-formed address is dropped rather than displayed.
  const parsedEmail = emailSchema.safeParse(firstSearchParam(params.email));
  const email = parsedEmail.success ? parsedEmail.data : null;

  return (
    <AuthCard
      title={failed ? "That link didn't work" : "Confirm your email"}
      description={
        failed
          ? "Verification links expire after 24 hours and can only be used once."
          : email
            ? `We've sent a confirmation link to ${email}. Follow it to activate your account.`
            : "We've sent you a confirmation link. Follow it to activate your account."
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
      <Alert variant={failed ? "destructive" : "default"}>
        {failed ? <AlertCircle /> : <MailCheck />}
        <AlertDescription>
          {failed
            ? "Send yourself a fresh link and open it from this device."
            : "You won't be able to sign in until your email is confirmed. Check your spam folder if it hasn't arrived."}
        </AlertDescription>
      </Alert>

      {email ? <ResendVerification email={email} callbackURL={returnTo} /> : null}
    </AuthCard>
  );
}

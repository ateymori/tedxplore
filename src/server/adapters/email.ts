// Outbound transactional email.
//
// The rest of the app talks to `sendEmail` and never imports `resend` directly
// (architectural invariant 4) — which is what lets the console transport below
// stand in for a real account that hasn't been provisioned yet.

import "server-only";
import { render } from "@react-email/components";
import { Resend } from "resend";
import { isEmailConfigured, serverEnv } from "@/config/env";

export type SendEmailInput = {
  to: string;
  subject: string;
  /** A React Email template element, e.g. `<VerifyEmail … />`. */
  react: React.ReactElement;
};

/**
 * Thrown when the provider rejects a message.
 *
 * Callers generally let this propagate: an unsent verification email is worse
 * than a failed sign-up, because the user is left with an account they can
 * never activate and no signal that anything went wrong.
 */
export class EmailDeliveryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EmailDeliveryError";
  }
}

let client: Resend | undefined;

function resendClient(apiKey: string): Resend {
  client ??= new Resend(apiKey);
  return client;
}

export async function sendEmail({ to, subject, react }: SendEmailInput): Promise<void> {
  const apiKey = serverEnv.RESEND_API_KEY;
  const from = serverEnv.EMAIL_FROM;

  if (!isEmailConfigured || apiKey === undefined || from === undefined) {
    await logEmailToConsole({ to, subject, react });
    return;
  }

  const { error } = await resendClient(apiKey).emails.send({
    from,
    to,
    subject,
    react,
  });

  // The SDK reports failures in the response rather than by throwing, so an
  // unchecked call silently swallows every bounce and auth error.
  if (error) {
    throw new EmailDeliveryError(`Resend rejected the message: ${error.message}`, {
      cause: error,
    });
  }
}

/**
 * Development fallback: print the email, including its links, to the server
 * console so verification and reset flows are testable without a Resend
 * account. Rendered as plain text specifically so the URLs are copyable.
 */
async function logEmailToConsole({ to, subject, react }: SendEmailInput): Promise<void> {
  const text = await render(react, { plainText: true });

  console.info(
    [
      "",
      "──────────────────────────────────────────────────────────",
      " EMAIL (not sent — RESEND_API_KEY is unset)",
      `   to:      ${to}`,
      `   subject: ${subject}`,
      "──────────────────────────────────────────────────────────",
      text.trim(),
      "──────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
}

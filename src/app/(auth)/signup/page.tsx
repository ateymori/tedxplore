import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";
import { isGoogleOAuthConfigured } from "@/config/env";
import { RETURN_TO_PARAM } from "@/config/routes";
import { resolveReturnTo } from "@/lib/return-to";
import { firstSearchParam, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const returnTo = resolveReturnTo(firstSearchParam(params[RETURN_TO_PARAM]));

  return <SignupForm returnTo={returnTo} googleEnabled={isGoogleOAuthConfigured} />;
}

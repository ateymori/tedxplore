import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { isGoogleOAuthConfigured } from "@/config/env";
import { RETURN_TO_PARAM } from "@/config/routes";
import { resolveReturnTo } from "@/lib/return-to";
import { firstSearchParam, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  // Sanitized here, once, so the client component and every link it builds
  // receive a value that is already known to be a local path.
  const returnTo = resolveReturnTo(firstSearchParam(params[RETURN_TO_PARAM]));

  return <LoginForm returnTo={returnTo} googleEnabled={isGoogleOAuthConfigured} />;
}

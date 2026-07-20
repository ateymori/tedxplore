// Request proxy (Next.js 16's renamed `middleware`).
//
// Two jobs, both deliberately cheap:
//
//   1. Optimistically bounce signed-out visitors away from protected paths, and
//      signed-in ones away from the auth pages.
//   2. Record the request path in a header so server-side guards can build a
//      `returnTo` back to it.
//
// It reads the session *cookie* and never validates it — a forged or expired
// cookie sails straight through. That is intentional (a database round trip on
// every navigation is the wrong price for a redirect), and it is why the real
// check lives in `src/server/auth-guards.ts`. Never treat a path as protected
// because it appears in the matcher below.

import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import {
  DEFAULT_AUTHENTICATED_PATH,
  PATHNAME_HEADER,
  RETURN_TO_PARAM,
  isAuthPath,
  isProtectedPath,
} from "@/config/routes";
import { loginPathWithReturnTo, resolveReturnTo } from "@/lib/return-to";

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search, searchParams } = request.nextUrl;
  const hasSessionCookie = getSessionCookie(request) !== null;

  if (isProtectedPath(pathname) && !hasSessionCookie) {
    // Preserve the query string too — an entry point like
    // `/dashboard/events/new?templateId=aurora` (FR-51) is meaningless without it.
    const target = loginPathWithReturnTo(`${pathname}${search}`);
    return NextResponse.redirect(new URL(target, request.url));
  }

  if (isAuthPath(pathname) && hasSessionCookie) {
    // Password reset is reachable while signed in — the token in the URL is the
    // whole point, and someone who arrived from the email should not be bounced.
    if (!searchParams.has("token")) {
      const target = resolveReturnTo(searchParams.get(RETURN_TO_PARAM), DEFAULT_AUTHENTICATED_PATH);
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  // `NextResponse.next` with request headers forwards them to the render,
  // rather than setting them on the response the browser sees.
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, `${pathname}${search}`);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Scoped to the application surface. Public event sites (`/tedx…`) and the
  // marketing home page are excluded so they stay purely static — they have no
  // session-dependent behaviour to add.
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ],
};

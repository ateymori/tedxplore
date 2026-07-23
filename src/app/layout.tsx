import type { Metadata } from "next";
import { SmoothScroll } from "@/components/smooth-scroll";
import { SITE_NAME, SITE_DESCRIPTION, APP_URL } from "@/config/site";
import "./globals.css";

/**
 * The root layout is shared by the app chrome *and* the public `[site]` route,
 * so it deliberately declares no fonts (task 10.3). Inter (sans) and Geist
 * Mono are the app chrome's faces and are applied by the four group layouts
 * under it; the public event sites bring their own via the template.
 * Declaring them here would put them on every event site's critical path —
 * preloaded and never rendered — which is the exact waste this split removes.
 * See `src/app/fonts.ts`.
 */
export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      {/*
        Lenis smooth scrolling for the whole app — chrome, marketing, auth,
        admin, the public event templates, and every preview. Mounted once here
        because the root layout is inherited by every route (including `[site]`
        and `/preview/*`), so a single instance drives them all with no risk of
        a second Lenis fighting the first. `SmoothScroll` is a client island; it
        renders `{children}` (server components) straight through and manages the
        instance imperatively, so nothing below is forced to the client. It
        no-ops under `prefers-reduced-motion` and pauses when an overlay locks
        the page. See the globals.css note on the `scroll-behavior` override that
        keeps templates' native smooth scroll from fighting Lenis.
      */}
      {/*
        `suppressHydrationWarning` on `<body>` only: several browser extensions
        (ColorZilla's `cz-shortcut-listen`, Grammarly, password managers, …)
        inject attributes onto `<body>` before React hydrates, which is a
        mismatch React can't reconcile and isn't caused by anything in this
        app's code — the extension's own DOM write happens outside React
        entirely. This is the fix Next.js documents for exactly this case; it
        only silences attribute/text warnings on this one element, not the
        subtree, so a genuine hydration bug anywhere else still surfaces.
      */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}

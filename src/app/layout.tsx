import type { Metadata } from "next";
import { SITE_NAME, SITE_DESCRIPTION, APP_URL } from "@/config/site";
import "./globals.css";

/**
 * The root layout is shared by the app chrome *and* the public `[site]` route,
 * so it deliberately declares no fonts (task 10.3). Geist is the app chrome's
 * face and is applied by the four group layouts under it; the public event
 * sites bring their own via the template. Declaring Geist here would put it on
 * every event site's critical path — preloaded and never rendered — which is
 * the exact waste this split removes. See `src/app/fonts.ts`.
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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

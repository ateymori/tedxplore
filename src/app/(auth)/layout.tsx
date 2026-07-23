import Link from "next/link";
import { appFontClassName } from "@/app/fonts";
import { Providers } from "@/components/providers";
import { ThemeSwitch } from "@/components/theme-switch";
import { HOME_PATH } from "@/config/routes";
import { SITE_NAME } from "@/config/site";

/**
 * Shell for every auth page. A route group, so `/login` stays `/login` — the
 * `(auth)` folder groups the layout without appearing in any URL.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div
        className={`${appFontClassName} flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12`}
      >
        <Link
          href={HOME_PATH}
          className="text-lg font-semibold tracking-tight transition-opacity hover:opacity-70"
        >
          {SITE_NAME}
        </Link>
        <main className="w-full max-w-sm">{children}</main>
      </div>
      <ThemeSwitch />
    </Providers>
  );
}

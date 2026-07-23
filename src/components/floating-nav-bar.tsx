"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";

/**
 * A sticky top bar that condenses into a floating glass pill once the page
 * scrolls, with a mobile menu on narrow viewports.
 *
 * Adapted from React Bits Pro's `navigation-9` block (originally a full demo
 * page with hardcoded branding/links) into a brand/nav/actions slot API, so
 * the app's session-aware nav (`SiteNavShell` + `SiteNavLinks`/`SiteNavUser`
 * in `site-nav.tsx`) can drive real content without this component knowing
 * about routes, auth, or Cache Components streaming.
 *
 * Three equal grid columns (not `auto 1fr auto`) so `navItems` sits at the
 * bar's true visual center regardless of how wide `brand` or `actions` are —
 * an asymmetric layout would center it in the leftover space instead, which
 * drifts off-center the moment the signed-in `actions` slot (avatar chip +
 * sign-out) outweighs the short wordmark in `brand`.
 *
 * `navItems` and `actions` are each rendered twice on purpose — once inline
 * for desktop, once inside the mobile panel — so both must be safe to mount
 * twice; the session lookups they wrap are request-cached, so this costs no
 * extra query and the mobile copies only ever mount once the panel opens.
 */
export function FloatingNavBar({
  brand,
  navItems,
  actions,
}: {
  brand: React.ReactNode;
  navItems: React.ReactNode;
  actions: React.ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="sticky top-4 z-40 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-8xl">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className={`relative flex items-center py-3 pr-5 pl-5 transition-[background-color,backdrop-filter,border-color,box-shadow,border-radius] duration-300 ease-out ${scrolled
            ? "rounded-full border bg-background/70 shadow-[0_8px_30px_-10px_rgba(0,0,0,0.08)] backdrop-blur-xl"
            : "rounded-none border border-transparent bg-transparent"
            }`}
        >
          <nav aria-label="Primary" className="grid w-full grid-cols-3 items-center gap-4">
            <div className="flex items-center justify-self-start">{brand}</div>

            <div className="hidden items-center justify-self-center md:flex">{navItems}</div>

            <div className="flex items-center justify-self-end gap-2">
              <div className="hidden items-center gap-3 md:flex">{actions}</div>

              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="grid h-10 w-10 place-items-center rounded-[10px] border text-foreground md:hidden"
                aria-label="Toggle menu"
                aria-expanded={open}
              >
                {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </nav>
        </motion.div>

        <AnimatePresence>
          {open ? (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mt-2 flex flex-col items-start gap-3 rounded-2xl border bg-background/90 p-4 backdrop-blur-xl md:hidden"
            >
              {navItems}
              <div className="flex w-full items-center gap-3 border-t pt-3">{actions}</div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

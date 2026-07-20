"use client";

import { Menu, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import type { AuroraNavItem } from "../sections";

/**
 * Aurora's section nav.
 *
 * Anchor links, not a router — the whole event site is one page, so navigation
 * is scrolling. That keeps it working with JavaScript disabled and makes every
 * entry a real, copyable URL (`/tedxfoo#speakers`).
 *
 * Three behaviours justify the client boundary: the transparent-over-hero
 * transition, the scroll-spy that marks the current section, and the mobile
 * menu. The links themselves are server-rendered into the first HTML, so the
 * nav is complete and usable before this component ever hydrates.
 */

/** How far down the page the bar stops being transparent. Roughly the point
 * where hero content has scrolled behind it and contrast would suffer. */
const SOLID_AFTER_PX = 64;

interface AuroraSiteNavProps {
  displayName: string;
  items: AuroraNavItem[];
  registrationUrl: string | null;
}

export function AuroraSiteNav({ displayName, items, registrationUrl }: AuroraSiteNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SOLID_AFTER_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll-spy. The asymmetric `rootMargin` shrinks the observation band to a
  // strip near the top of the viewport, so "current" means "the section whose
  // start you have most recently passed" rather than "whichever section
  // happens to occupy the most pixels" — the latter flickers between a short
  // section and its tall neighbour.
  useEffect(() => {
    if (items.length === 0) return;

    const targets = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => element !== null);

    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length === 0) return;

        // Topmost intersecting section wins, so scrolling up de-activates
        // sections in the same order scrolling down activated them.
        const topmost = visible.reduce((best, entry) =>
          entry.boundingClientRect.top < best.boundingClientRect.top ? entry : best,
        );
        setActiveId(topmost.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );

    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, [items]);

  // Escape closes the menu — expected of anything that overlays the page, and
  // the only way out for a keyboard user who opened it by mistake.
  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const hasNav = items.length > 0;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled || menuOpen
          ? "border-aurora-line/60 bg-aurora-void/85 border-b backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-6 sm:px-8 lg:h-20 lg:px-12">
        {/*
          Allowed to shrink and ellipsize rather than `shrink-0`. Display names
          run to 60 characters ("TEDxUniversity of California, Santa Cruz") and
          an unshrinkable wordmark pushed the menu button off a 360px viewport,
          which gives the whole page a horizontal scrollbar. `min-w-0` is the
          part that actually does it — a flex item's automatic minimum size
          would otherwise refuse to go below its text width.
        */}
        <a
          href="#top"
          className="text-aurora-snow hover:text-aurora-ember min-w-0 truncate text-base font-semibold tracking-tight transition-colors lg:text-lg"
        >
          {displayName}
        </a>

        {hasNav ? (
          <nav aria-label="Sections" className="ml-auto hidden lg:block">
            <ul className="flex items-center gap-8">
              {items.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    aria-current={activeId === item.id ? "true" : undefined}
                    className={cn(
                      "text-sm font-medium transition-colors",
                      activeId === item.id
                        ? "text-aurora-snow"
                        : "text-aurora-fog hover:text-aurora-snow",
                    )}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {/*
          `ml-auto` at every width, so the CTA and menu button sit against the
          right edge. Below `lg` the section nav is `display: none` and was the
          only thing supplying an automatic margin — which left the menu button
          tucked up against the wordmark on exactly the viewports where it is
          the only navigation there is. At `lg` the nav's own `ml-auto` has
          already taken the free space, and the fixed gap resumes.
        */}
        <div className={cn("ml-auto flex items-center gap-2", hasNav && "lg:ml-8")}>
          {registrationUrl ? (
            <a
              href={registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-aurora-red hover:bg-aurora-red-deep hidden rounded-full px-5 py-2 text-sm font-semibold text-white transition-colors sm:inline-block"
            >
              Get tickets
            </a>
          ) : null}

          {hasNav ? (
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="aurora-mobile-nav"
              className="text-aurora-snow -mr-2 inline-flex size-10 items-center justify-center lg:hidden"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
            </button>
          ) : null}
        </div>
      </div>

      {hasNav ? (
        <nav
          id="aurora-mobile-nav"
          aria-label="Sections"
          hidden={!menuOpen}
          className="border-aurora-line/60 bg-aurora-void/95 border-t backdrop-blur-xl lg:hidden"
        >
          <ul className="mx-auto flex max-w-6xl flex-col px-6 py-2 sm:px-8">
            {items.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={closeMenu}
                  aria-current={activeId === item.id ? "true" : undefined}
                  className={cn(
                    "block py-3 text-base font-medium transition-colors",
                    activeId === item.id
                      ? "text-aurora-snow"
                      : "text-aurora-fog hover:text-aurora-snow",
                  )}
                >
                  {item.label}
                </a>
              </li>
            ))}
            {registrationUrl ? (
              <li className="border-aurora-line/60 mt-2 border-t pt-4 pb-3 sm:hidden">
                <a
                  href={registrationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-aurora-red hover:bg-aurora-red-deep block rounded-full px-5 py-3 text-center text-sm font-semibold text-white transition-colors"
                >
                  Get tickets
                </a>
              </li>
            ) : null}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

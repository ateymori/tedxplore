"use client";

import { Suspense, useEffect, useRef, type RefObject } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

// NOTE: `lenis/dist/lenis.css` is deliberately NOT imported. Its recommended
// defaults include `html.lenis, html.lenis body { height: auto }`, which
// overrides our root layout's `html.h-full` — and a `min-height: 100%` (the
// `body`/group-layout `min-h-full` sticky-footer fill) only resolves against a
// *definite* parent height. With height forced to `auto`, short pages stop
// filling the viewport, exposing the document canvas — which reads dark because
// `html:has(.aurora)` paints it aurora-void whenever an `.aurora` node is on the
// page (e.g. the homepage template poster). Lenis needs none of that stylesheet
// to work; the only rule we actually want — disabling native smooth scroll while
// Lenis runs — lives in globals.css keyed off the `.lenis-smooth` class Lenis
// adds itself in JS.

/**
 * Buttery smooth scrolling for the whole app via Lenis.
 *
 * Mounted **once in the root layout**, so a single Lenis instance drives every
 * route the root layout is inherited by — app chrome, marketing, auth, admin,
 * the public `[site]` templates, the Live Preview, and both `/preview/*` routes.
 * One instance on purpose: the admin review screen renders a template *inside*
 * the already-scrolled admin chrome, so a second Lenis would fight the first.
 *
 * Lenis drives the *real* window scroll (it does not transform a virtual
 * container), so nothing structural changes here — the component just renders
 * its children and manages the instance imperatively.
 *
 * ## Why the route-change scroll reset is a Suspense-wrapped child
 *
 * The reset needs `usePathname()`, which under Cache Components is runtime data.
 * Read here — in a client component that wraps the entire app above every
 * `<Suspense>` boundary — it makes every route a blocking prerender
 * (`blocking-route`, which failed the build). Isolating it in `RouteScrollReset`
 * behind its own boundary keeps this wrapper runtime-data-free so `{children}`
 * prerenders, exactly as the admin section nav does with `AdminNavLink`.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // Reduced-motion users get native scrolling, untouched. There is nothing to
    // start/stop and no Lenis instance to reset on navigation — Next's default
    // scroll restoration already puts them at the top of each new page.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const lenis = new Lenis({
      duration: 1.6,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });
    lenisRef.current = lenis;

    let rafId = requestAnimationFrame(function raf(time) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    });

    // In-page anchors: intercept `#` links and hand them to Lenis so the jump is
    // smooth and lands clear of any fixed header.
    const onAnchorClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.('a[href^="#"]');
      if (!anchor) {
        return;
      }
      const href = anchor.getAttribute("href");
      // A bare "#" has no target to scroll to; leave it to the browser.
      if (!href || href === "#") {
        return;
      }
      const target = document.querySelector(href);
      if (!target) {
        return;
      }
      event.preventDefault();
      lenis.scrollTo(target as HTMLElement, { offset: -100 });
    };
    document.addEventListener("click", onAnchorClick);

    // Pause Lenis whenever an overlay locks the page. Lenis scrolls
    // programmatically and ignores the CSS overflow lock that Base UI's Dialog
    // (and any other overlay) puts on the document, so without this the page
    // scrolls *behind* an open dialog. Base UI signals a lock two ways depending
    // on the platform's scrollbar style — a `data-base-ui-scroll-locked`
    // attribute on <html>, or `overflow: hidden` on <html>/<body> — so we watch
    // for both and let the computed state decide.
    const isScrollLocked = () => {
      const html = document.documentElement;
      if (html.hasAttribute("data-base-ui-scroll-locked")) {
        return true;
      }
      return (
        getComputedStyle(html).overflowY === "hidden" ||
        getComputedStyle(document.body).overflowY === "hidden"
      );
    };
    const syncLockState = () => {
      if (isScrollLocked()) {
        lenis.stop();
      } else {
        lenis.start();
      }
    };
    const lockObserver = new MutationObserver(syncLockState);
    lockObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "data-base-ui-scroll-locked"],
    });
    lockObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["style"],
    });

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("click", onAnchorClick);
      lockObserver.disconnect();
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <RouteScrollReset lenisRef={lenisRef} />
      </Suspense>
      {children}
    </>
  );
}

/**
 * Resets scroll to the top on every route change (never on the first render,
 * which is a fresh load already at the top). Renders nothing; it exists only to
 * confine the `usePathname()` runtime read to its own `<Suspense>` boundary.
 */
function RouteScrollReset({ lenisRef }: { lenisRef: RefObject<Lenis | null> }) {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Reduced motion / no instance: Next's own scroll restoration handles it.
    const lenis = lenisRef.current;
    if (!lenis) {
      return;
    }
    // Lenis caches its own scroll position; without the immediate `scrollTo` it
    // would snap the new page back to the previous page's offset.
    window.scrollTo(0, 0);
    lenis.scrollTo(0, { immediate: true });
  }, [pathname, lenisRef]);

  return null;
}

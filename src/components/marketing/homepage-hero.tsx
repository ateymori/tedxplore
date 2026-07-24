"use client";

import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useState } from "react";
import { NeuroNoise } from "@paper-design/shaders-react";
import StaggeredText from "@/components/react-bits/staggered-text";

function useIsDark() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const read = () => {
      const classes = document.documentElement.classList;
      if (classes.contains("dark")) return true;
      if (classes.contains("light")) return false;
      return query.matches;
    };
    const update = () => setIsDark(read());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    query.addEventListener("change", update);
    return () => {
      observer.disconnect();
      query.removeEventListener("change", update);
    };
  }, []);

  return isDark;
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.08 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

/**
 * The marketing homepage hero (FR-49).
 *
 * Adapted from React Bits Pro's `hero-24` block: the animated shader
 * background and reveal choreography are unchanged, but the copy, badge, and
 * actions are Tedxplore's own rather than the vendor placeholder ("Synaptics").
 */
export function HomepageHero() {
  const isDark = useIsDark();
  const reduceMotion = useReducedMotion();
  const neuro = isDark
    ? {
        colorBack: "#0a0a0a",
        colorMid: "#5b7bff",
        colorFront: "#c9b8ff",
        brightness: 0.22,
        contrast: 0.42,
      }
    : {
        colorBack: "#ffffff",
        colorMid: "#aebcff",
        colorFront: "#6b57ff",
        brightness: 0.62,
        contrast: 0.42,
      };

  return (
    <section className="relative flex min-h-screen w-full items-start overflow-hidden bg-white px-4 pt-40 pb-16 dark:bg-neutral-950 sm:px-6 sm:py-20 md:pt-40 lg:items-center lg:px-8 lg:pt-20">
      <NeuroNoise
        key={isDark ? "dark" : "light"}
        className="absolute inset-0 h-full w-full"
        style={{ width: "100%", height: "100%" }}
        colorBack={neuro.colorBack}
        colorMid={neuro.colorMid}
        colorFront={neuro.colorFront}
        brightness={neuro.brightness}
        contrast={neuro.contrast}
        scale={1.15}
        offsetX={0.42}
        speed={reduceMotion ? 0 : 0.55}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.96)_18%,rgba(255,255,255,0.72)_46%,rgba(255,255,255,0)_82%)] dark:hidden"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(to_right,rgba(10,10,10,0.94)_18%,rgba(10,10,10,0.62)_46%,rgba(10,10,10,0)_82%)] dark:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_60%,rgba(255,255,255,0.9))] dark:bg-[linear-gradient(to_bottom,rgba(10,10,10,0)_60%,rgba(10,10,10,0.9))]"
      />

      {/*
        The upward nudge only makes sense with `lg:items-center` above: it
        pulls the vertically-centered desktop layout up for visual balance.
        Below `lg` the section is `items-start` with its own top padding, so
        the same translate would pull content up into (and, combined with
        `overflow-hidden`, sometimes entirely behind) the floating nav bar.
      */}
      <div className="relative z-10 mx-auto w-full max-w-[1400px] lg:-translate-y-20">
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="flex max-w-2xl flex-col items-start text-left lg:max-w-none"
        >
          {/*
            The container above still orchestrates the subtitle/button
            stagger via framer-motion `variants`, but StaggeredText manages
            its own reveal (per-word, via its own IntersectionObserver) — it
            isn't part of that variants tree. `rootMargin` is set to match
            the container's `viewport.margin` so the headline and the rest
            of the hero trigger at roughly the same scroll position.
          */}
          <StaggeredText
            as="h1"
            text="Premium TEDx event websites.|Built from your content."
            separator="|"
            direction="bottom"
            duration={1.0}
            delay={40}
            rootMargin="-80px"
            className="max-w-6xl text-4xl font-bold leading-[1.19] tracking-tight text-balance text-neutral-950 dark:text-white sm:text-6xl md:text-[2.75rem] lg:text-6xl"
          />

          <motion.p
            variants={item}
            className="mt-6 max-w-4xl text-xl text-neutral-600 dark:text-neutral-300 md:max-w-none md:whitespace-nowrap lg:max-w-none lg:text-2xl lg:whitespace-nowrap"
          >
            Choose a stunning template, add your event details, and launch!
          </motion.p>

          <motion.div
            variants={item}
            className="mt-20 flex w-full flex-col gap-3 sm:mt-10 sm:w-auto sm:flex-row"
          >
            <a
              href="#templates-heading"
              className="inline-flex w-full cursor-pointer items-center justify-center rounded-full bg-neutral-950 px-6 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 dark:focus-visible:ring-offset-neutral-950 sm:w-auto sm:px-8 sm:py-3.5 sm:text-base"
            >
              Choose your template
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

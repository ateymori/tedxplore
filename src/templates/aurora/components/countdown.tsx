"use client";

import { useEffect, useMemo, useState } from "react";

import { countdownLabel, countdownParts, type CountdownParts } from "../lib/event-date";

/**
 * The live countdown (FR-39).
 *
 * Necessarily a Client Component, and not because of the ticking: published
 * sites are statically rendered (NFR-1), so a server-computed remaining time
 * would be frozen at build time and could be months stale by the first visit.
 * The only correct clock is the visitor's.
 *
 * That makes the first paint a genuine unknown, which is what `parts ===
 * undefined` represents below — distinct from `null`, which is the definite
 * answer "the event has passed". The placeholder occupies the exact final
 * layout so filling it in shifts nothing (NFR-1's Lighthouse target is a CLS
 * target too).
 */

const UNITS: { key: keyof CountdownParts; label: string }[] = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hrs" },
  { key: "minutes", label: "Min" },
  { key: "seconds", label: "Sec" },
];

export function AuroraCountdown({ startsAt }: { startsAt: string }) {
  const targetMs = useMemo(() => new Date(startsAt).getTime(), [startsAt]);
  const [parts, setParts] = useState<CountdownParts | null | undefined>(undefined);

  useEffect(() => {
    const tick = () => setParts(countdownParts(targetMs, Date.now()));

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [targetMs]);

  if (parts === null) {
    return (
      <p className="text-aurora-fog text-aurora-h3 font-medium">This event has taken place.</p>
    );
  }

  return (
    <div>
      {/*
        The grid is decorative to a screen reader — read cell by cell it is a
        string of bare numbers. One sentence is announced instead, and it is
        polite rather than assertive so a per-second update never interrupts
        whatever the visitor is actually reading.
      */}
      <p className="sr-only" aria-live="polite">
        {parts === undefined ? "" : countdownLabel(parts)}
      </p>

      <ul aria-hidden="true" className="flex gap-3 sm:gap-5">
        {UNITS.map(({ key, label }) => (
          <li
            key={key}
            className="border-aurora-line/70 bg-aurora-ink/60 min-w-16 rounded-xl border px-3 py-3 text-center backdrop-blur-sm sm:min-w-20 sm:px-4"
          >
            <span className="text-aurora-snow block font-[family-name:var(--font-aurora-mono)] text-2xl leading-none font-semibold tabular-nums sm:text-3xl">
              {parts === undefined ? "––" : String(parts[key]).padStart(2, "0")}
            </span>
            <span className="text-aurora-fog mt-2 block text-[0.65rem] font-medium tracking-[0.18em] uppercase">
              {label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

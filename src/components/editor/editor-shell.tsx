"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

import { AboutSection } from "@/components/editor/sections/about-section";
import { ContactSection } from "@/components/editor/sections/contact-section";
import { FaqsSection } from "@/components/editor/sections/faqs-section";
import { HeroSection } from "@/components/editor/sections/hero-section";
import { RegistrationSection } from "@/components/editor/sections/registration-section";
import { ScheduleSection } from "@/components/editor/sections/schedule-section";
import { SpeakersSection } from "@/components/editor/sections/speakers-section";
import { SponsorsSection } from "@/components/editor/sections/sponsors-section";
import { TeamSection } from "@/components/editor/sections/team-section";
import { VenueSection } from "@/components/editor/sections/venue-section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EditorDefaults } from "@/content/editor-defaults";

/**
 * The editor shell (task 5.1).
 *
 * Every section is a sibling on one long page rather than a tab or a wizard
 * step. A TEDx site is a single scrolling page, so an editor shaped the same
 * way keeps the mental model intact — and more practically, an organizer
 * filling this in works from a document, jumping between speakers and venue
 * and back. Tabs would make each of those jumps a click that discards nothing
 * but feels like it might.
 */

const SECTIONS = [
  { id: "hero", label: "Name and theme" },
  { id: "about", label: "About" },
  { id: "schedule", label: "Date and time" },
  { id: "venue", label: "Venue" },
  { id: "speakers", label: "Speakers" },
  { id: "team", label: "Team" },
  { id: "sponsors", label: "Sponsors" },
  { id: "faqs", label: "FAQ" },
  { id: "contact", label: "Contact" },
  { id: "registration", label: "Registration" },
] as const;

export function EditorShell({
  eventId,
  defaults,
  initialUpdatedAt,
}: {
  eventId: string;
  defaults: EditorDefaults;
  initialUpdatedAt: Date;
}) {
  /**
   * One conflict banner for the whole page, not one per section.
   *
   * A concurrent edit is a fact about the *event*, and the reload it invites
   * reloads everything. Six sections each reporting the same thing would read
   * as six separate problems.
   */
  const [conflicted, setConflicted] = useState(false);
  const onConflict = useCallback(() => setConflicted(true), []);

  const activeSection = useActiveSection();

  const sectionProps = { eventId, initialUpdatedAt, onConflict };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
      <nav aria-label="Editor sections" className="lg:sticky lg:top-24 lg:w-48 lg:shrink-0">
        <ul className="flex flex-row flex-wrap gap-x-1 gap-y-1 lg:flex-col">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={activeSection === section.id ? "true" : undefined}
                className={cn(
                  "block rounded-md px-3 py-1.5 text-sm transition-colors",
                  activeSection === section.id
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        {conflicted ? (
          <Alert>
            <TriangleAlert />
            <AlertTitle>This event was edited somewhere else</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
              <p>
                Your changes were saved, but another session — another tab, or another device — had
                already made its own. Reload to see the combined result before you keep editing.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                <RefreshCw />
                Reload
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <HeroSection
          {...sectionProps}
          defaultValues={defaults.hero}
          initialImage={defaults.heroImage}
        />
        <AboutSection {...sectionProps} defaultValues={defaults.about} />
        <ScheduleSection {...sectionProps} defaultValues={defaults.schedule} />
        <VenueSection
          {...sectionProps}
          defaultValues={defaults.venue}
          initialImage={defaults.venueImage}
        />
        <SpeakersSection {...sectionProps} initialItems={defaults.speakers} />
        <TeamSection {...sectionProps} initialItems={defaults.team} />
        <SponsorsSection {...sectionProps} initialItems={defaults.sponsors} />
        <FaqsSection {...sectionProps} initialItems={defaults.faqs} />
        <ContactSection {...sectionProps} defaultValues={defaults.contact} />
        <RegistrationSection {...sectionProps} defaultValues={defaults.registration} />
      </div>
    </div>
  );
}

/**
 * Highlights the section currently in view.
 *
 * The top quarter of the viewport is the "reading line": a section counts as
 * active once its heading passes it. Keying off the topmost *intersecting*
 * entry rather than the most recently crossed boundary means scrolling back up
 * highlights correctly too, which the naive version gets wrong.
 *
 * Purely decorative — the nav is anchor links that work without JavaScript,
 * and this only adds the highlight.
 */
function useActiveSection(): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const elements = SECTIONS.map((section) => document.getElementById(section.id)).filter(
      (element): element is HTMLElement => element !== null,
    );

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) setActive(visible[0].target.id);
      },
      // A tall negative bottom margin collapses the observed band to a strip
      // near the top of the viewport, so exactly one section is "current".
      { rootMargin: "-25% 0px -70% 0px", threshold: 0 },
    );

    for (const element of elements) observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return active;
}

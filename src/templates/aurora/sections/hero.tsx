import { DEFAULT_HERO_SUBTITLE } from "@/config/platform-copy";
import type { EventContent } from "@/content/event-content";

import { AuroraBackdrop } from "../components/backdrop";
import { AuroraCountdown } from "../components/countdown";
import { AuroraLinkButton } from "../components/cta";
import { AuroraImage, resolveImage } from "../components/image";
import { Parallax, Reveal } from "../components/reveal";
import { AuroraContainer } from "../components/section";
import { formatEventDate, formatEventTime } from "../lib/event-date";

/**
 * The Hero — the one section that always renders, for every event, in every
 * state (FR-38).
 *
 * Two of its elements are organizer-editable and both fall back rather than
 * disappearing: a blank Theme is replaced by platform default subtitle copy
 * (BR-5d), and absent hero imagery is replaced by the template's own visual.
 * Note the asymmetry with every *other* section on the page — those auto-hide
 * when empty and never substitute anything (BR-13). Getting these two rules
 * confused is the specific mistake task 4.7 exists to check for.
 *
 * The date, countdown, and registration button are not part of that promise.
 * They are ordinary optional content: absent means absent, and the hero simply
 * composes with fewer elements.
 */
export function AuroraHero({ content }: { content: EventContent }) {
  const { schedule, registrationUrl, heroImage } = content;

  // Resolved up front rather than inside the JSX: the fallback is a different
  // element, not a different `src`, so the decision has to be made before
  // anything is laid out.
  const hero = resolveImage(heroImage, undefined, { crop: "fill", aspectRatio: 16 / 9 });

  return (
    <section
      id="top"
      aria-labelledby="hero-heading"
      className="relative flex min-h-[92svh] items-end overflow-hidden pt-28 pb-16 sm:pb-24"
    >
      {/* The backdrop drifts at half the page's scroll speed. Only the backdrop
          — hero text that moves independently of its own section is a
          readability problem, not an effect. */}
      <Parallax className="absolute inset-0">
        {hero !== null && heroImage !== null ? (
          <>
            <AuroraImage
              image={heroImage}
              // Decorative: the event's name is stated in the heading directly
              // over it, so alt text here would only repeat it (NFR-3).
              alt=""
              sizes="100vw"
              crop="fill"
              aspectRatio={16 / 9}
              priority
              className="h-full w-full scale-110 object-cover"
            />
            {/* Organizer photography is unpredictable; without a scrim the
                display name can land on a bright sky and become unreadable. */}
            <div
              aria-hidden="true"
              className="from-aurora-void via-aurora-void/70 absolute inset-0 bg-gradient-to-t to-black/25"
            />
          </>
        ) : (
          <AuroraBackdrop />
        )}
      </Parallax>

      <AuroraContainer className="relative">
        <div className="max-w-4xl">
          {/*
            The display name is deliberately *not* revealed. It is the Largest
            Contentful Paint element on every event site, and fading it in would
            push LCP out by the length of the animation for no design gain —
            the title being instantly present is what the rest settles around.
          */}
          <h1 id="hero-heading" className="text-aurora-display text-aurora-snow">
            {content.displayName}
          </h1>

          <Reveal on="load">
            <p className="text-aurora-lead text-aurora-fog mt-7 max-w-2xl">
              {content.theme ?? DEFAULT_HERO_SUBTITLE}
            </p>
          </Reveal>

          {schedule.startsAt !== null ? (
            <Reveal on="load" index={1}>
              <p className="text-aurora-snow mt-10 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-base font-medium sm:text-lg">
                <span>{formatEventDate(schedule.startsAt, schedule.timezone)}</span>
                <span aria-hidden="true" className="text-aurora-line">
                  ·
                </span>
                <span className="text-aurora-fog">
                  {formatEventTime(schedule.startsAt, schedule.timezone)}
                </span>
              </p>
            </Reveal>
          ) : null}

          {schedule.startsAt !== null ? (
            <Reveal on="load" index={2}>
              <div className="mt-8">
                <AuroraCountdown startsAt={schedule.startsAt} />
              </div>
            </Reveal>
          ) : null}

          {registrationUrl !== null ? (
            <Reveal on="load" index={3}>
              <div className="mt-10">
                <AuroraLinkButton href={registrationUrl}>Get tickets</AuroraLinkButton>
              </div>
            </Reveal>
          ) : null}
        </div>
      </AuroraContainer>
    </section>
  );
}

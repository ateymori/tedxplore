"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import type { SpeakerContent } from "@/content/event-content";

import { AuroraSocialLinks } from "./social-links";

/**
 * One speaker card, and the detail dialog behind it.
 *
 * The card is a dialog trigger *only when there is more to show* — a speaker
 * with no bio and no links has already told you everything on the card face,
 * and making that a button would promise a reveal that never comes. Half-filled
 * speaker lists are the normal state for months before an event, so both
 * variants have to look equally intentional.
 *
 * `portrait` arrives pre-rendered from the Server Component parent rather than
 * being built here: it resolves Cloudinary URLs and a `srcset`, none of which
 * needs to reach the browser as JavaScript.
 */
export function AuroraSpeakerCard({
  speaker,
  portrait,
}: {
  speaker: SpeakerContent;
  portrait: ReactNode;
}) {
  const hasDetail = speaker.bio !== null || speaker.links.length > 0;

  const face = (
    <>
      {portrait}
      <div className="mt-5">
        {speaker.talkTitle !== null ? (
          <p className="text-aurora-h3 text-aurora-snow group-hover:text-aurora-ember transition-colors">
            {speaker.talkTitle}
          </p>
        ) : null}
        <p
          className={
            speaker.talkTitle !== null
              ? "text-aurora-fog mt-2 text-sm font-medium"
              : "text-aurora-h3 text-aurora-snow"
          }
        >
          {speaker.name}
        </p>
        {speaker.title !== null ? (
          <p className="text-aurora-fog/80 mt-1 text-sm">{speaker.title}</p>
        ) : null}
      </div>
    </>
  );

  if (!hasDetail) {
    return <article className="group">{face}</article>;
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger className="group block w-full cursor-pointer text-left">
        {face}
        {/*
          The accessible name of a button is its whole text content, which here
          would be the talk title followed by the name and role — accurate, but
          it never says what activating it does.
        */}
        <span className="sr-only">{` — read more about ${speaker.name}`}</span>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm" />
        <Dialog.Popup className="aurora data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 border-aurora-line bg-aurora-ink fixed top-1/2 left-1/2 z-[60] max-h-[85svh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border p-6 outline-none sm:p-8">
          {/*
            The popup is portalled to `document.body`, outside the `.aurora`
            subtree — so it carries the class itself, or it would inherit the
            application's shadcn theme and render as a white dialog.
          */}
          <Dialog.Close
            aria-label="Close"
            className="text-aurora-fog hover:text-aurora-snow absolute top-4 right-4 inline-flex size-9 items-center justify-center rounded-full transition-colors"
          >
            <X className="size-4" />
          </Dialog.Close>

          {speaker.talkTitle !== null ? (
            <p className="text-aurora-eyebrow text-aurora-ember mb-4 pr-10 font-semibold uppercase">
              {speaker.talkTitle}
            </p>
          ) : null}

          <Dialog.Title className="text-aurora-h3 text-aurora-snow pr-10">
            {speaker.name}
          </Dialog.Title>

          {speaker.title !== null ? (
            <p className="text-aurora-fog mt-1 text-sm">{speaker.title}</p>
          ) : null}

          {speaker.bio !== null ? (
            <Dialog.Description className="text-aurora-fog mt-6 leading-relaxed whitespace-pre-line">
              {speaker.bio}
            </Dialog.Description>
          ) : null}

          <AuroraSocialLinks links={speaker.links} owner={speaker.name} className="mt-6" />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

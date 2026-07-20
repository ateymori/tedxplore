import { Badge } from "@/components/ui/badge";
import type { PublicationStatus, PublishRequestStatus } from "@/generated/prisma/enums";

/**
 * Publication and review status, as the dashboard shows them (FR-11).
 *
 * These are two independent facts and are rendered as two badges, because they
 * genuinely can disagree: a live site can have a pending resubmission (FR-31),
 * and a never-published draft can carry a rejection the owner still has to act
 * on (FR-33). Collapsing them into one label would hide whichever came second.
 *
 * Both switches are exhaustive over their enum, so adding a state fails to
 * compile until it has been given a label.
 */

interface StatusPresentation {
  label: string;
  variant: React.ComponentProps<typeof Badge>["variant"];
}

function publicationPresentation(status: PublicationStatus): StatusPresentation {
  switch (status) {
    case "NEVER_PUBLISHED":
      return { label: "Draft", variant: "outline" };
    case "PUBLISHED":
      return { label: "Live", variant: "default" };
    case "UNPUBLISHED":
      return { label: "Unpublished", variant: "secondary" };
    case "SUSPENDED":
      return { label: "Suspended", variant: "destructive" };
  }
}

/**
 * Returns `null` for states that say nothing the publication badge doesn't
 * already say: an approved request *is* the live site, and a request the owner
 * cancelled has no lasting consequence.
 */
function reviewPresentation(status: PublishRequestStatus): StatusPresentation | null {
  switch (status) {
    case "PENDING":
      return { label: "In review", variant: "secondary" };
    case "REJECTED":
      return { label: "Changes requested", variant: "destructive" };
    case "APPROVED":
    case "CANCELED":
      return null;
  }
}

export function PublicationStatusBadge({ status }: { status: PublicationStatus }) {
  const { label, variant } = publicationPresentation(status);
  return <Badge variant={variant}>{label}</Badge>;
}

export function ReviewStatusBadge({ status }: { status: PublishRequestStatus }) {
  const presentation = reviewPresentation(status);
  if (presentation === null) return null;

  return <Badge variant={presentation.variant}>{presentation.label}</Badge>;
}

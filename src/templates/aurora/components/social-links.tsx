import type { SocialLink } from "@/content/event-content";
import { cn } from "@/lib/utils";

import { SOCIAL_ICONS, SOCIAL_LABELS } from "./social-icons";

/**
 * A row of social links, used by speakers, team members, the contact section,
 * and the footer.
 *
 * `owner` names whose links these are ("Amara Okonjo", "TEDxAurora Bay") and
 * becomes part of each link's accessible name. Without it a page with sixteen
 * speakers announces sixteen identical "Instagram" links, which is unusable
 * with a screen reader's link list (NFR-3).
 *
 * Renders nothing for an empty list — every caller's section already decides
 * its own visibility, and a stray empty row would leave unexplained space.
 */
export function AuroraSocialLinks({
  links,
  owner,
  className,
  size = "sm",
}: {
  links: SocialLink[];
  owner: string;
  className?: string;
  size?: "sm" | "md";
}) {
  if (links.length === 0) return null;

  return (
    <ul className={cn("flex flex-wrap items-center gap-3", className)}>
      {links.map((link) => {
        const Icon = SOCIAL_ICONS[link.platform];

        return (
          <li key={`${link.platform}-${link.url}`}>
            <a
              href={link.url}
              // BR-12: organizer-supplied destinations are always external.
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "text-aurora-fog hover:text-aurora-snow inline-flex items-center justify-center transition-colors",
                size === "sm" ? "size-8" : "size-10",
              )}
            >
              <Icon className={size === "sm" ? "size-4" : "size-5"} />
              <span className="sr-only">{`${owner} on ${SOCIAL_LABELS[link.platform]}`}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

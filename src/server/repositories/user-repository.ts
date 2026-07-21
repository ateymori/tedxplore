import { prisma } from "./prisma";

/**
 * User data access.
 *
 * Better Auth owns the `user` table's writes — sign-up, verification, password
 * changes, and the `role` field all go through it (`server/auth.ts`), and this
 * module deliberately offers no way to mutate any of that. It exists for the
 * one thing Better Auth has no opinion about: reading a user in order to *tell
 * them something* about an event they own.
 */

export interface OwnerContact {
  email: string;
  name: string | null;
}

/**
 * The address to notify about an event, or `null` if the owner is gone.
 *
 * Nullable rather than throwing because callers are notification paths, and a
 * missing owner must not turn a completed approval into a failed one — the
 * ownership FK cascades on delete, so this is only reachable in the narrow
 * window where an account is deleted mid-review.
 *
 * `name` is Better Auth's optional profile name, normalized from its empty
 * string to `null` so the email templates' `name ? … : …` greeting behaves.
 */
export async function findOwnerContact(userId: string): Promise<OwnerContact | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (user === null) return null;

  const name = user.name.trim();
  return { email: user.email, name: name.length > 0 ? name : null };
}

/**
 * Admin event search by owner (task 7.6): resolves an email or name fragment to
 * ids the event query can filter on.
 *
 * Two queries rather than a join because the admin index searches slug *or*
 * owner and unions the results — see `admin-service.ts`, where keeping the
 * owner lookup separate is what lets a single search box mean both.
 */
export async function findUserIdsMatching(query: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true },
    // An admin searching "gmail.com" should get a usable page, not every user.
    take: 100,
  });

  return users.map((user) => user.id);
}

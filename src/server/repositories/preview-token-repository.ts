import { prisma } from "./prisma";

/**
 * Preview-token data access (FR-25..FR-27).
 *
 * One active token per event: issuing a new one revokes the outstanding one
 * in the same transaction, so "regenerate" and "revoke then create" cannot
 * leave two live tokens behind.
 */

export async function findActiveToken(eventId: string) {
  return prisma.previewToken.findFirst({
    where: { eventId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

/** Resolves a token to its event, or `null` if unknown or revoked. */
export async function findEventIdByToken(token: string): Promise<string | null> {
  const row = await prisma.previewToken.findFirst({
    where: { token, revokedAt: null },
    select: { eventId: true },
  });

  return row?.eventId ?? null;
}

/**
 * Issues a token, revoking any existing active one first. The caller supplies
 * the token value — generating it is a service concern (256 bits from
 * `crypto.randomBytes`, per tech-stack decision 6).
 */
export async function issueToken(eventId: string, token: string) {
  return prisma.$transaction(async (tx) => {
    await tx.previewToken.updateMany({
      where: { eventId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return tx.previewToken.create({ data: { eventId, token } });
  });
}

/** FR-26: revocation takes effect immediately on the next request. */
export async function revokeActiveTokens(eventId: string): Promise<number> {
  const { count } = await prisma.previewToken.updateMany({
    where: { eventId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return count;
}

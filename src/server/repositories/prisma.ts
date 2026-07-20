import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Next.js dev-mode module reloads would otherwise spawn a new PrismaClient
// (and connection pool) on every edit; cache the instance on `globalThis`.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Whether an error is a unique-constraint violation (Prisma `P2002`).
 *
 * Lives here so the driver's error codes stay inside the data-access layer
 * (NFR-9): services need to know "someone claimed this first", not what
 * Postgres or Prisma call it. Duck-typed rather than `instanceof` because the
 * error crosses a module boundary where the generated client's class identity
 * is not guaranteed to be the same one the service imported.
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

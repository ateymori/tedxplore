/**
 * Promotes an existing user to ADMIN (FR-4).
 *
 *   pnpm exec tsx scripts/grant-admin.ts you@example.com
 *   pnpm exec tsx scripts/grant-admin.ts you@example.com --revoke
 *
 * There is deliberately no in-app way to do this. `role` is declared with
 * `input: false` in the Better Auth config, so it cannot be set through sign-up
 * or any client call — the only path to the admin role is someone with database
 * credentials running this script. V1 has a single admin (the product owner),
 * so a self-service admin UI would be more attack surface than feature.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const [email, flag] = process.argv.slice(2);

  if (!email) {
    console.error("Usage: pnpm exec tsx scripts/grant-admin.ts <email> [--revoke]");
    process.exit(1);
  }

  const role = flag === "--revoke" ? "USER" : "ADMIN";

  const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    // Addresses are stored lowercased by the sign-up schema; normalize here so
    // a capitalized argument still matches.
    const user = await prisma.user.update({
      where: { email: email.trim().toLowerCase() },
      data: { role },
      select: { email: true, role: true },
    });

    console.info(`${user.email} is now ${user.role}.`);
  } catch {
    console.error(`No user found with email ${email}. They must sign up first.`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();

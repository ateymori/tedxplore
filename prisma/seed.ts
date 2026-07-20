import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { DEFAULT_TEMPLATE_ID, findTemplate } from "../src/templates/registry";

/**
 * Development seed: the platform admin (A-1) and one demo event.
 *
 * Idempotent — safe to re-run. Everything keys off a stable slug or email, so
 * repeated runs update rather than duplicate.
 *
 * The demo event's content comes from the template registry's demo seed — the
 * same one the create-event flow uses (FR-10) — rather than being hand-written
 * here. Local data therefore always matches what a real new event looks like,
 * and improving the demo copy in one place improves both.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@tedxplore.com";
const DEMO_SLUG = "demoevent";

async function main() {
  // A-1: the sole V1 admin. No credentials are created here — Better Auth
  // (Phase 2) owns the `account` table and its password hashing. Until then
  // this is a role-carrying user row; sign-in arrives with Phase 2, via
  // Google OAuth or a password reset against this address.
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: "ADMIN" },
    create: {
      id: randomUUID(),
      email: ADMIN_EMAIL,
      name: "Tedxplore Admin",
      emailVerified: true,
      role: "ADMIN",
    },
  });

  const template = findTemplate(DEFAULT_TEMPLATE_ID);
  if (template === null) throw new Error(`Template "${DEFAULT_TEMPLATE_ID}" is not registered.`);

  const seed = template.demoSeed(new Date());

  const event = await prisma.event.upsert({
    where: { slug: DEMO_SLUG },
    update: {},
    create: {
      ownerId: admin.id,
      slug: DEMO_SLUG,
      displayName: "TEDxDemo University",
      templateId: template.id,
      tedEventUrl: "https://www.ted.com/tedx/events/00000",
      licenseHolderName: "Tedxplore Admin",
      authorizationConfirmedAt: new Date(),

      theme: seed.theme,
      aboutText: seed.aboutText,
      eventDate: seed.eventDate,
      timezone: seed.timezone,
      venueName: seed.venueName,
      venueAddress: seed.venueAddress,
      venueDescription: seed.venueDescription,
      contactEmail: seed.contactEmail,
      registrationUrl: seed.registrationUrl,
      socialLinks: seed.socialLinks,

      speakers: { create: seed.speakers },
      teamMembers: { create: seed.teamMembers },
      sponsors: { create: seed.sponsors },
      faqs: { create: seed.faqs },
    },
  });

  console.log(`Seeded admin ${admin.email} and event /tedx${event.slug}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });

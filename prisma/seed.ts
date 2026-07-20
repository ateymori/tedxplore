import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Development seed: the platform admin (A-1) and one demo event.
 *
 * Idempotent — safe to re-run. Everything keys off a stable slug or email, so
 * repeated runs update rather than duplicate.
 *
 * The demo event's content is intentionally hand-written here rather than
 * imported from the template's `demoContent`: that lives in the template
 * registry and does not exist until Phase 4. Once it does, this script should
 * seed *from* it so local data and the real new-event seed stay identical.
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

  const event = await prisma.event.upsert({
    where: { slug: DEMO_SLUG },
    update: {},
    create: {
      ownerId: admin.id,
      slug: DEMO_SLUG,
      displayName: "TEDxDemo University",
      templateId: "aurora",
      tedEventUrl: "https://www.ted.com/tedx/events/00000",
      licenseHolderName: "Tedxplore Admin",
      authorizationConfirmedAt: new Date(),

      theme: "Ideas worth spreading, close to home",
      aboutText:
        "A day of talks, conversations, and performances from thinkers and makers in our community.",
      eventDate: new Date("2026-11-14T18:00:00.000Z"),
      timezone: "America/Toronto",
      venueName: "Pollack Hall",
      venueAddress: "555 Sherbrooke St W, Montreal, QC",
      venueDescription: "A 600-seat concert hall in the heart of downtown.",
      contactEmail: "hello@example.com",
      registrationUrl: "https://example.com/tickets",
      socialLinks: [
        { platform: "INSTAGRAM", url: "https://instagram.com/example" },
        { platform: "X", url: "https://x.com/example" },
      ],

      speakers: {
        create: [
          {
            name: "Ada Lovelace",
            title: "Mathematician",
            talkTitle: "On the engines yet to come",
            bio: "Writes about computation before it exists.",
            sortOrder: 0,
          },
          {
            name: "Grace Hopper",
            title: "Computer Scientist",
            talkTitle: "Why the best answer is 'let's try it'",
            bio: "Believes the most dangerous phrase is 'we've always done it this way'.",
            sortOrder: 1,
          },
        ],
      },
      teamMembers: {
        create: [
          { name: "Sam Lee", role: "Curator", sortOrder: 0 },
          { name: "Jordan Reyes", role: "Production Lead", sortOrder: 1 },
        ],
      },
      sponsors: {
        create: [
          { name: "Acme Foundation", tier: "PARTNER", websiteUrl: "https://example.com", sortOrder: 0 },
          { name: "Northwind Labs", tier: "GOLD", websiteUrl: "https://example.com", sortOrder: 1 },
        ],
      },
      faqs: {
        create: [
          {
            question: "Is there parking nearby?",
            answer: "Yes — an underground lot sits directly beneath the venue.",
            sortOrder: 0,
          },
          {
            question: "Will talks be recorded?",
            answer: "Every talk is filmed and published to the TEDx channel afterwards.",
            sortOrder: 1,
          },
        ],
      },
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

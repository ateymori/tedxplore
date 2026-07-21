/**
 * Task 9.3 verification — the admin report inbox, at the service layer.
 *
 *   pnpm exec tsx --tsconfig tsconfig.script.json scripts/verify-9-3.ts
 *
 * Unlike 9.1/9.2 this needs no running server: the inbox is authenticated, so
 * there is no anonymous HTTP surface to probe. It drives the services directly
 * — the same way every phase has verified its admin logic against the real
 * database — and checks the three things worth checking: the admin gate holds
 * on every entry point, closing races the way two admins actually would, and
 * the list withholds the reporter's address.
 *
 * Creates its own event, reports, and users, and deletes all of them at the
 * end, so it is safe to run against the dev database repeatedly.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";

import { prisma } from "@/server/repositories/prisma";
import type { SessionUser } from "@/server/auth";
import { closeReport, getReportDetail, listReports } from "@/server/services/report-admin-service";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const SUFFIX = Date.now();
const asUser = (id: string, role: "USER" | "ADMIN"): SessionUser => ({ id, role }) as SessionUser;

async function main() {
  console.log("\nVerifying the admin report inbox (service layer)\n");

  // --- Fixtures ------------------------------------------------------------
  const owner = await prisma.user.create({
    data: {
      id: randomUUID(),
      email: `owner-${SUFFIX}@verify.test`,
      name: "Owner",
      emailVerified: true,
    },
  });
  const adminUser = await prisma.user.create({
    data: {
      id: randomUUID(),
      email: `admin-${SUFFIX}@verify.test`,
      name: "Admin",
      emailVerified: true,
      role: "ADMIN",
    },
  });
  const otherAdmin = await prisma.user.create({
    data: {
      id: randomUUID(),
      email: `admin2-${SUFFIX}@verify.test`,
      name: "Admin2",
      emailVerified: true,
      role: "ADMIN",
    },
  });
  const event = await prisma.event.create({
    data: {
      ownerId: owner.id,
      slug: `verify${SUFFIX}`,
      displayName: "TEDxVerify",
      templateId: "aurora",
      publicationStatus: "PUBLISHED",
      tedEventUrl: "https://www.ted.com/tedx/events/00000",
      licenseHolderName: "Verify",
      authorizationConfirmedAt: new Date(),
    },
  });
  const report = await prisma.report.create({
    data: {
      eventId: event.id,
      category: "IMPERSONATION",
      explanation: "Verification fixture — not a real report.",
      reporterEmail: "reporter@verify.test",
      reporterIpHash: "0".repeat(64),
    },
  });

  const admin = asUser(adminUser.id, "ADMIN");
  const second = asUser(otherAdmin.id, "ADMIN");
  const notAdmin = asUser(owner.id, "USER");

  try {
    console.log("The admin gate holds on every entry point");
    {
      const list = await listReports(notAdmin);
      const detail = await getReportDetail(notAdmin, report.id);
      const close = await closeReport(notAdmin, report.id, "RESOLVED");

      check("listReports refuses a non-admin", !list.ok && list.error.type === "FORBIDDEN");
      check("getReportDetail refuses a non-admin", !detail.ok && detail.error.type === "FORBIDDEN");
      check("closeReport refuses a non-admin", !close.ok && close.error.type === "FORBIDDEN");
      // The report must still be open — a refused close must not have written.
      const after = await prisma.report.findUnique({ where: { id: report.id } });
      check("and the refused close wrote nothing", after?.status === "OPEN");
    }

    console.log("\nThe list withholds the reporter's address");
    {
      const list = await listReports(admin);
      const row = list.ok ? list.value.find((r) => r.id === report.id) : undefined;

      check("the report appears", row !== undefined);
      check(
        "the row reports presence, not the address",
        row !== undefined && row.hasReporterEmail === true && !("reporterEmail" in row),
        "the raw email is on a triage row",
      );
    }

    console.log("\nThe detail view does show the address");
    {
      const detail = await getReportDetail(admin, report.id);
      check(
        "the reporter email is present on the detail",
        detail.ok && detail.value.reporterEmail === "reporter@verify.test",
      );
      check("the owner is included", detail.ok && detail.value.event.owner.email === owner.email);
    }

    console.log("\nClosing, and the two-admin race");
    {
      const first = await closeReport(admin, report.id, "RESOLVED");
      check("the first close succeeds", first.ok);

      const stored = await prisma.report.findUnique({ where: { id: report.id } });
      check(
        "it records the resolver and time",
        stored?.resolverId === adminUser.id && stored?.resolvedAt !== null,
      );
      check("and the status", stored?.status === "RESOLVED");

      // A *different* admin acting on the same report, a beat later.
      const raced = await closeReport(second, report.id, "DISMISSED");
      check(
        "a second admin's close is refused, not silently applied",
        !raced.ok && raced.error.type === "INVALID_STATE",
        "the second admin overwrote the first's decision",
      );

      const unchanged = await prisma.report.findUnique({ where: { id: report.id } });
      check(
        "and the first decision stands",
        unchanged?.status === "RESOLVED" && unchanged?.resolverId === adminUser.id,
      );
    }

    console.log("\nA missing report is NOT_FOUND, not a crash");
    {
      const detail = await getReportDetail(admin, "nonexistent-id");
      const close = await closeReport(admin, "nonexistent-id", "RESOLVED");
      check("getReportDetail", !detail.ok && detail.error.type === "NOT_FOUND");
      check("closeReport", !close.ok && close.error.type === "NOT_FOUND");
    }
  } finally {
    // Tear the fixtures down regardless of outcome.
    await prisma.report.deleteMany({ where: { eventId: event.id } });
    await prisma.event.delete({ where: { id: event.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [owner.id, adminUser.id, otherAdmin.id] } },
    });
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

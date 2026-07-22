import path from "node:path";

/**
 * The two accounts the smoke suite signs in as.
 *
 * They are seeded once into the local dev database (persistent — a real
 * Postgres, not a throwaway) and reused across runs, so the storage-state files
 * below are what most tests authenticate with rather than the login form. That
 * keeps sign-ins rare, which matters: Better Auth rate-limits `/sign-in/email`
 * to 5/minute in dev (task 9.4), and a suite that logged in on every test would
 * trip its own protection.
 *
 * The password satisfies `PASSWORD_MIN_LENGTH` (8). These credentials are for
 * an ephemeral local database only; they are never used against any deployment.
 */
export interface TestUser {
  email: string;
  password: string;
  name: string;
  role: "USER" | "ADMIN";
  /** Where this user's authenticated browser state is saved. */
  statePath: string;
}

const authDir = path.join(__dirname, "..", ".auth");

export const OWNER: TestUser = {
  email: "e2e-owner@tedxplore.test",
  password: "e2e-password-123",
  name: "E2E Owner",
  role: "USER",
  statePath: path.join(authDir, "owner.json"),
};

export const ADMIN: TestUser = {
  email: "e2e-admin@tedxplore.test",
  password: "e2e-password-123",
  name: "E2E Admin",
  role: "ADMIN",
  statePath: path.join(authDir, "admin.json"),
};

export const TEST_USERS = [OWNER, ADMIN];

/**
 * The slug prefix every event this suite creates shares, so global teardown can
 * find and delete them without touching anything else. Slugs are lowercase
 * a–z only (BR-1), so the prefix and the random suffix both stay in that
 * alphabet — no digits.
 */
export const E2E_SLUG_PREFIX = "eee";

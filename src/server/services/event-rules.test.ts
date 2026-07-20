import { describe, expect, it } from "vitest";

import type { PublicationStatus } from "@/generated/prisma/enums";
import { deletionMode, deletionReleasesSlug, isSlugEditable } from "@/server/services/event-rules";

// Every state in BR-6, listed explicitly rather than derived from the enum:
// adding a state should break this file and force a decision about it.
const EVER_PUBLISHED: PublicationStatus[] = ["PUBLISHED", "UNPUBLISHED", "SUSPENDED"];

describe("isSlugEditable (BR-5)", () => {
  it("allows editing before the first publication", () => {
    expect(isSlugEditable("NEVER_PUBLISHED")).toBe(true);
  });

  it.each(EVER_PUBLISHED)("locks the slug permanently once published: %s", (status) => {
    expect(isSlugEditable(status)).toBe(false);
  });
});

describe("deletionMode (FR-13)", () => {
  it("hard-deletes a never-published draft", () => {
    expect(deletionMode("NEVER_PUBLISHED")).toBe("HARD");
  });

  it.each(EVER_PUBLISHED)("soft-deletes anything ever published: %s", (status) => {
    expect(deletionMode(status)).toBe("SOFT");
  });

  it("releases the slug only on a hard delete", () => {
    expect(deletionReleasesSlug("NEVER_PUBLISHED")).toBe(true);

    for (const status of EVER_PUBLISHED) {
      expect(deletionReleasesSlug(status)).toBe(false);
    }
  });
});

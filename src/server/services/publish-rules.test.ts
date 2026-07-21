import { describe, expect, it } from "vitest";

import type { PublicationStatus } from "@/generated/prisma/enums";
import {
  canRepublish,
  canRestore,
  canSubmitForReview,
  canSuspend,
  canUnpublish,
  isPubliclyVisible,
  restoredStatus,
  type PublishState,
} from "./publish-rules";

/**
 * The publication state machine (BR-6, BR-8a, BR-10).
 *
 * Every rule is checked against *every* status rather than only the interesting
 * ones. These functions decide whether a stranger's website is visible on the
 * internet, and the failure mode of a missed case is silent — a state that
 * should have been refused simply goes through. Enumerating the whole enum in
 * each table means adding a status makes these tests fail loudly instead of
 * quietly skipping it.
 */

const ALL_STATUSES: PublicationStatus[] = [
  "NEVER_PUBLISHED",
  "PUBLISHED",
  "UNPUBLISHED",
  "SUSPENDED",
];

function state(overrides: Partial<PublishState> = {}): PublishState {
  return {
    publicationStatus: "NEVER_PUBLISHED",
    hasLiveSnapshot: false,
    suspendedFromStatus: null,
    ...overrides,
  };
}

describe("canSubmitForReview", () => {
  it.each(ALL_STATUSES)("allows %s unless suspended", (publicationStatus) => {
    expect(canSubmitForReview(state({ publicationStatus }))).toBe(
      publicationStatus !== "SUSPENDED",
    );
  });

  // The rule that matters: a suspended owner must not be able to route back to
  // live through the ordinary queue, where an unwitting reviewer would approve
  // it and undo the suspension (BR-10 makes restoring an admin-only act).
  it("refuses a suspended event even though it has approved content", () => {
    expect(
      canSubmitForReview(
        state({
          publicationStatus: "SUSPENDED",
          hasLiveSnapshot: true,
          suspendedFromStatus: "PUBLISHED",
        }),
      ),
    ).toBe(false);
  });
});

describe("canUnpublish", () => {
  it.each(ALL_STATUSES)("allows %s only when published", (publicationStatus) => {
    expect(canUnpublish(state({ publicationStatus, hasLiveSnapshot: true }))).toBe(
      publicationStatus === "PUBLISHED",
    );
  });
});

describe("canRepublish", () => {
  it.each(ALL_STATUSES)("allows %s only when unpublished", (publicationStatus) => {
    expect(canRepublish(state({ publicationStatus, hasLiveSnapshot: true }))).toBe(
      publicationStatus === "UNPUBLISHED",
    );
  });

  it("refuses when there is no approved snapshot to put back", () => {
    expect(canRepublish(state({ publicationStatus: "UNPUBLISHED", hasLiveSnapshot: false }))).toBe(
      false,
    );
  });
});

describe("canSuspend", () => {
  it.each(ALL_STATUSES)("allows %s only when published or unpublished", (publicationStatus) => {
    expect(canSuspend(state({ publicationStatus, hasLiveSnapshot: true }))).toBe(
      publicationStatus === "PUBLISHED" || publicationStatus === "UNPUBLISHED",
    );
  });

  // Without this, an owner could unpublish the moment a report landed and
  // republish (which needs no review) the moment the admin looked away.
  it("covers an unpublished event, which the owner could otherwise put back live", () => {
    expect(canSuspend(state({ publicationStatus: "UNPUBLISHED", hasLiveSnapshot: true }))).toBe(
      true,
    );
  });
});

describe("canRestore", () => {
  it.each(ALL_STATUSES)("allows %s only when suspended", (publicationStatus) => {
    expect(canRestore(state({ publicationStatus }))).toBe(publicationStatus === "SUSPENDED");
  });
});

describe("restoredStatus", () => {
  const suspended = (suspendedFromStatus: PublicationStatus | null) =>
    state({ publicationStatus: "SUSPENDED", hasLiveSnapshot: true, suspendedFromStatus });

  it("puts a site that was live back live", () => {
    expect(restoredStatus(suspended("PUBLISHED"))).toBe("PUBLISHED");
  });

  // The case the stored column exists for: an owner who had already taken their
  // site offline must not find it public again because an admin lifted a ban.
  it("leaves a site the owner had taken offline offline", () => {
    expect(restoredStatus(suspended("UNPUBLISHED"))).toBe("UNPUBLISHED");
  });

  it("falls back to unpublished when there is no record of the prior state", () => {
    expect(restoredStatus(suspended(null))).toBe("UNPUBLISHED");
  });

  it("never restores to live without a snapshot to serve", () => {
    expect(
      restoredStatus(
        state({
          publicationStatus: "SUSPENDED",
          hasLiveSnapshot: false,
          suspendedFromStatus: "PUBLISHED",
        }),
      ),
    ).toBe("UNPUBLISHED");
  });
});

describe("isPubliclyVisible", () => {
  it.each(ALL_STATUSES)("shows %s only when published", (publicationStatus) => {
    expect(isPubliclyVisible(state({ publicationStatus, hasLiveSnapshot: true }))).toBe(
      publicationStatus === "PUBLISHED",
    );
  });

  it("hides a published event whose snapshot pointer is gone", () => {
    expect(
      isPubliclyVisible(state({ publicationStatus: "PUBLISHED", hasLiveSnapshot: false })),
    ).toBe(false);
  });
});

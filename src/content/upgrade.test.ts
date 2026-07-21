import { describe, expect, it } from "vitest";

import { CURRENT_SCHEMA_VERSION, emptyEventContent } from "./event-content";
import {
  SnapshotUpgradeError,
  applyMigrations,
  trySnapshotUpgrade,
  upgradeSnapshotContent,
} from "./upgrade";

/** A snapshot as it is actually stored: JSON, not an `EventContent` instance. */
function storedSnapshot(overrides: Record<string, unknown> = {}) {
  return { ...JSON.parse(JSON.stringify(emptyEventContent("TEDxAvelorne"))), ...overrides };
}

describe("upgradeSnapshotContent", () => {
  it("passes a current-version snapshot through", () => {
    const content = upgradeSnapshotContent(storedSnapshot());

    expect(content.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(content.displayName).toBe("TEDxAvelorne");
  });

  it("returns a parsed document, not the raw input", () => {
    // The return value is what templates consume, so it must have been through
    // the schema — an unvalidated passthrough would defer the failure to a
    // template rendering `undefined`.
    const raw = storedSnapshot({ unexpectedField: "ignored" });

    expect(upgradeSnapshotContent(raw)).not.toHaveProperty("unexpectedField");
  });

  it("refuses a snapshot from a newer deployment rather than silently dropping fields", () => {
    // Reachable during a rolling deploy. Parsing a v2 document with the v1
    // schema would look like content vanishing from a live site.
    const future = storedSnapshot({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 });

    expect(() => upgradeSnapshotContent(future)).toThrow(SnapshotUpgradeError);
    expect(() => upgradeSnapshotContent(future)).toThrow(/rolling deploy/);
  });

  it("refuses content with no usable schemaVersion", () => {
    // `schemaVersion` is the one field every version carries; without it there
    // is no way to know which migrations apply.
    for (const version of [undefined, null, "1", 0, -1, 1.5]) {
      expect(() => upgradeSnapshotContent(storedSnapshot({ schemaVersion: version }))).toThrow(
        SnapshotUpgradeError,
      );
    }
  });

  it("refuses content that is not an object at all", () => {
    for (const raw of [null, undefined, "a string", 42, ["an", "array"]]) {
      expect(() => upgradeSnapshotContent(raw)).toThrow(SnapshotUpgradeError);
    }
  });

  it("reports which fields failed when a document of a known version does not fit", () => {
    // Means a migration is incomplete, or something other than the serializer
    // wrote the row. The message has to name the field or it is unactionable.
    const broken = storedSnapshot({ displayName: "" });

    expect(() => upgradeSnapshotContent(broken)).toThrow(/displayName/);
  });
});

describe("trySnapshotUpgrade", () => {
  it("reports failure as a value, for callers that render an error", () => {
    const result = trySnapshotUpgrade(storedSnapshot({ schemaVersion: 999 }));

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBeInstanceOf(SnapshotUpgradeError);
  });

  it("returns the content on success", () => {
    const result = trySnapshotUpgrade(storedSnapshot());

    expect(result.ok).toBe(true);
    expect(result.ok === true && result.content.displayName).toBe("TEDxAvelorne");
  });
});

/**
 * The chain-walking machinery, driven with synthetic versions.
 *
 * At v1 the real migration table is empty and the real loop never runs, so
 * without these the scaffold would ship entirely unexercised — and the day a
 * v2 lands is the worst possible day to discover the walker is wrong.
 */
describe("applyMigrations", () => {
  const migrations = {
    1: (content: Record<string, unknown>) => ({ ...content, schemaVersion: 2, added: "by v2" }),
    2: (content: Record<string, unknown>) => ({ ...content, schemaVersion: 3, added: "by v3" }),
  };

  it("applies nothing when the document is already current", () => {
    const document = { schemaVersion: 3 };

    expect(applyMigrations(document, 3, 3, migrations)).toEqual(document);
  });

  it("applies a single step", () => {
    expect(applyMigrations({ schemaVersion: 1 }, 1, 2, migrations)).toEqual({
      schemaVersion: 2,
      added: "by v2",
    });
  });

  it("walks the whole chain in order, not just the last step", () => {
    // If the loop applied only `MIGRATIONS[toVersion - 1]`, this would still
    // end at schemaVersion 3 — the `added` field is what distinguishes a real
    // walk from a lucky one.
    const result = applyMigrations({ schemaVersion: 1 }, 1, 3, migrations);

    expect(result.schemaVersion).toBe(3);
    expect(result.added).toBe("by v3");
  });

  it("names the missing link when the chain has a gap", () => {
    // The failure a forgotten migration produces, and the message has to say
    // which version needs writing.
    expect(() => applyMigrations({ schemaVersion: 1 }, 1, 4, migrations)).toThrow(
      /No migration from schemaVersion 3 to 4/,
    );
  });

  it("does not mutate the document it is given", () => {
    // Migrations return new objects; a mutating one would corrupt a cached
    // snapshot in place, since the upgrade runs on every read.
    const original = { schemaVersion: 1 };
    applyMigrations(original, 1, 3, migrations);

    expect(original).toEqual({ schemaVersion: 1 });
  });
});

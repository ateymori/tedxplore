import { describe, expect, it } from "vitest";

import { toParagraphs } from "./text";

describe("toParagraphs", () => {
  it("splits on blank lines", () => {
    expect(toParagraphs("First para.\n\nSecond para.")).toEqual(["First para.", "Second para."]);
  });

  // A single newline is a line break the organizer typed inside one thought —
  // the renderer keeps it with `white-space: pre-line` rather than making it a
  // new paragraph.
  it("keeps single newlines inside a paragraph", () => {
    expect(toParagraphs("Line one\nline two")).toEqual(["Line one\nline two"]);
  });

  it("treats a run of blank lines as one break", () => {
    expect(toParagraphs("A.\n\n\n\nB.")).toEqual(["A.", "B."]);
  });

  it("tolerates whitespace-only lines between paragraphs", () => {
    expect(toParagraphs("A.\n   \nB.")).toEqual(["A.", "B."]);
  });

  it("trims each paragraph", () => {
    expect(toParagraphs("  A.  \n\n  B.  ")).toEqual(["A.", "B."]);
  });

  it("yields nothing for blank input", () => {
    expect(toParagraphs("")).toEqual([]);
    expect(toParagraphs("   \n\n  ")).toEqual([]);
  });
});

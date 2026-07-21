import { describe, expect, it } from "vitest";

import { ACCEPTED_IMAGE_FORMATS, eventMediaFolder, isAcceptedImageFormat } from "./media";

describe("isAcceptedImageFormat", () => {
  it("accepts every declared format", () => {
    for (const format of ACCEPTED_IMAGE_FORMATS) {
      expect(isAcceptedImageFormat(format)).toBe(true);
    }
  });

  it("is case-insensitive, since the source is Cloudinary's report", () => {
    expect(isAcceptedImageFormat("JPG")).toBe(true);
    expect(isAcceptedImageFormat("PNG")).toBe(true);
  });

  it("rejects SVG (FR-21's 'otherwise rejected' branch)", () => {
    // An SVG is a document that can carry script. Every rendition is served
    // through a transform that rasterizes it anyway, so accepting one would buy
    // nothing but the risk.
    expect(isAcceptedImageFormat("svg")).toBe(false);
  });

  it("rejects other formats Cloudinary will happily store", () => {
    for (const format of ["gif", "bmp", "tiff", "pdf", "ico", "heic"]) {
      expect(isAcceptedImageFormat(format)).toBe(false);
    }
  });

  it("rejects blanks and near-misses", () => {
    expect(isAcceptedImageFormat("")).toBe(false);
    expect(isAcceptedImageFormat("jpgx")).toBe(false);
    expect(isAcceptedImageFormat(" jpg")).toBe(false);
  });
});

describe("eventMediaFolder", () => {
  it("namespaces every asset under its event", () => {
    expect(eventMediaFolder("abc123")).toBe("tedxplore/events/abc123");
  });

  it("gives different events disjoint prefixes", () => {
    // The property the upload signature and the attach-time prefix check both
    // rely on: one event's folder is never a prefix of another's, so a
    // `startsWith` test cannot be fooled by an id that merely begins the same.
    const a = `${eventMediaFolder("abc")}/`;
    const b = `${eventMediaFolder("abcdef")}/`;

    expect(b.startsWith(a)).toBe(false);
    expect(a.startsWith(b)).toBe(false);
  });
});

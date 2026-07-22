import { describe, expect, it } from "vitest";

import { emptyEventContent, type EventContent, type ImageRef } from "./event-content";
import { collectImagePublicIds } from "./image-refs";

const ref = (publicId: string): ImageRef => ({
  cloudinaryPublicId: publicId,
  width: 800,
  height: 600,
});

describe("collectImagePublicIds", () => {
  it("returns nothing for content with no images", () => {
    expect(collectImagePublicIds(emptyEventContent("TEDxTest")).size).toBe(0);
  });

  it("collects every image slot across the document", () => {
    const content: EventContent = {
      ...emptyEventContent("TEDxTest"),
      heroImage: ref("hero"),
      venue: { name: null, address: null, description: null, image: ref("venue") },
      speakers: [
        {
          id: "a",
          name: "A",
          title: null,
          bio: null,
          talkTitle: null,
          links: [],
          photo: ref("sp1"),
        },
        { id: "b", name: "B", title: null, bio: null, talkTitle: null, links: [], photo: null },
      ],
      team: [{ id: "t", name: "T", role: null, links: [], photo: ref("team1") }],
      sponsors: [
        { id: "s", name: "S", tier: "GOLD", websiteUrl: null, logo: ref("logo1") },
        { id: "s2", name: "S2", tier: "GOLD", websiteUrl: null, logo: null },
      ],
    };

    expect(collectImagePublicIds(content)).toEqual(
      new Set(["hero", "venue", "sp1", "team1", "logo1"]),
    );
  });

  it("deduplicates a public id reused across slots", () => {
    const content: EventContent = {
      ...emptyEventContent("TEDxTest"),
      heroImage: ref("shared"),
      venue: { name: null, address: null, description: null, image: ref("shared") },
    };

    expect(collectImagePublicIds(content)).toEqual(new Set(["shared"]));
  });
});

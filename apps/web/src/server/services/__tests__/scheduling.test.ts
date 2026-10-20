import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { schedulingProblems } from "../posts";

const one = [new ObjectId()];

describe("conditions de programmation", () => {
  it("Instagram accepte une image ou une vidéo, jamais rien", () => {
    expect(schedulingProblems({ network: "instagram", text: "x", mediaIds: [], mediaKind: null })[0]).toContain("exige une image ou une vidéo");
    expect(schedulingProblems({ network: "instagram", text: "x", mediaIds: one, mediaKind: "video" })).toEqual([]);
    expect(schedulingProblems({ network: "instagram", text: "x", mediaIds: one, mediaKind: "image" })).toEqual([]);
  });

  it("respecte les formats propres à chaque réseau", () => {
    expect(schedulingProblems({ network: "google_business", text: "x", mediaIds: one, mediaKind: "video" })[0]).toContain("n'accepte pas les vidéos");
    expect(schedulingProblems({ network: "youtube", text: "x", mediaIds: one, mediaKind: "image" })[0]).toContain("uniquement des vidéos");
    expect(schedulingProblems({ network: "youtube", text: "x", mediaIds: [], mediaKind: null })[0]).toContain("exige une vidéo");
    expect(schedulingProblems({ network: "x", text: "x", mediaIds: Array.from({ length: 5 }, () => new ObjectId()), mediaKind: "image" })[0]).toContain("au plus 4 images");
    for (const network of ["linkedin", "tiktok", "youtube", "pinterest", "x"] as const) {
      expect(schedulingProblems({ network, text: "x", mediaIds: one, mediaKind: "video" })).toEqual([]);
    }
  });
});

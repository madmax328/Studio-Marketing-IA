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

  it("signale les réseaux dont la publication vidéo n'est pas encore branchée", () => {
    expect(schedulingProblems({ network: "youtube", text: "x", mediaIds: one, mediaKind: "video" })[0]).toContain("arrive bientôt");
    expect(schedulingProblems({ network: "linkedin", text: "x", mediaIds: one, mediaKind: "video" })).toEqual([]);
  });
});

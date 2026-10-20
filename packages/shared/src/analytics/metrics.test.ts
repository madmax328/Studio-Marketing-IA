import { describe, expect, it } from "vitest";
import { cleanMetrics, computeRecommendations, engagementOf, timeSlotOf, type MeasuredPost } from "./metrics";

const post = (overrides: Partial<MeasuredPost>): MeasuredPost => ({
  network: "facebook",
  // Mardi 14 janvier 2025, 10:00 à Paris.
  publishedAt: new Date("2025-01-14T09:00:00Z"),
  timeZone: "Europe/Paris",
  hasMedia: true,
  engagement: 10,
  ...overrides,
});

describe("indicateurs", () => {
  it("additionne seulement les interactions fournies, sinon null", () => {
    expect(engagementOf({ likes: 10, comments: 2, views: 500 })).toBe(12);
    expect(engagementOf({ views: 500, reach: 300 })).toBeNull();
  });

  it("écarte les valeurs invalides des API", () => {
    expect(cleanMetrics({ likes: 4.4, comments: -1, shares: Number.NaN, views: "12" as unknown as number })).toEqual({ likes: 4 });
  });

  it("place une heure locale dans le bon créneau, fuseau compris", () => {
    expect(timeSlotOf(new Date("2025-07-01T17:30:00Z"), "Europe/Paris")?.id).toBe("soir");
    expect(timeSlotOf(new Date("2025-07-01T02:00:00Z"), "Europe/Paris")).toBeNull();
  });
});

describe("recommandations", () => {
  it("aucune avant 6 publications mesurées", () => {
    expect(computeRecommendations(Array.from({ length: 5 }, () => post({})))).toEqual([]);
  });

  it("signale un réseau nettement meilleur, avec la base de calcul", () => {
    const posts = [
      ...Array.from({ length: 3 }, () => post({ network: "instagram", engagement: 40 })),
      ...Array.from({ length: 3 }, () => post({ network: "facebook", engagement: 10 })),
    ];
    const network = computeRecommendations(posts).find((item) => item.id === "network");
    expect(network?.title).toContain("Instagram");
    expect(network?.detail).toContain("40");
    expect(network?.basedOn).toBe(6);
  });

  it("ne conclut rien si l'écart est faible ou les groupes trop petits", () => {
    const close = [
      ...Array.from({ length: 3 }, () => post({ network: "instagram", engagement: 11 })),
      ...Array.from({ length: 3 }, () => post({ network: "facebook", engagement: 10 })),
    ];
    expect(computeRecommendations(close).find((item) => item.id === "network")).toBeUndefined();
    const small = [...Array.from({ length: 2 }, () => post({ network: "instagram", engagement: 90 })), ...Array.from({ length: 5 }, () => post({}))];
    expect(computeRecommendations(small).find((item) => item.id === "network")).toBeUndefined();
  });

  it("compare le jour de publication dans le fuseau de l'utilisateur", () => {
    const posts = [
      ...Array.from({ length: 3 }, () => post({ publishedAt: new Date("2025-01-14T09:00:00Z"), engagement: 30 })), // mardi
      ...Array.from({ length: 3 }, () => post({ publishedAt: new Date("2025-01-16T09:00:00Z"), engagement: 5 })), // jeudi
    ];
    expect(computeRecommendations(posts).find((item) => item.id === "day")?.title).toBe("Le mardi fonctionne bien");
  });
});

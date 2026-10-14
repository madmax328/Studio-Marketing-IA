import { describe, expect, it } from "vitest";
import {
  SOCIAL_NETWORK_IDS,
  SOCIAL_NETWORKS,
  brandInputSchema,
  canTransitionPost,
  checkContentCompatibility,
  missingRecommendedFields,
  roleHasPermission,
} from "./index";

describe("catalogue des réseaux", () => {
  it("décrit chaque réseau déclaré", () => {
    for (const id of SOCIAL_NETWORK_IDS) {
      expect(SOCIAL_NETWORKS[id].id).toBe(id);
      expect(SOCIAL_NETWORKS[id].maxTextLength).toBeGreaterThan(0);
    }
  });

  it("refuse un texte seul sur Instagram", () => {
    expect(checkContentCompatibility("instagram", { text: "Bonjour", media: [] })).toHaveLength(1);
  });

  it("refuse un texte trop long sur X", () => {
    const problems = checkContentCompatibility("x", { text: "a".repeat(281), media: [] });
    expect(problems[0]).toContain("281 / 280");
  });

  it("refuse une image sur YouTube", () => {
    expect(checkContentCompatibility("youtube", { text: "", media: ["image"] })).not.toHaveLength(0);
  });

  it("accepte un post texte sur LinkedIn", () => {
    expect(checkContentCompatibility("linkedin", { text: "Bonjour", media: [] })).toEqual([]);
  });
});

describe("schéma de marque", () => {
  it("applique les valeurs par défaut", () => {
    const brand = brandInputSchema.parse({ name: "  Boulangerie Martin  " });
    expect(brand.name).toBe("Boulangerie Martin");
    expect(brand.primaryLanguage).toBe("fr");
    expect(brand.wordsToUse).toEqual([]);
  });

  it("exige un nom", () => {
    expect(brandInputSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("refuse une couleur mal formée", () => {
    expect(brandInputSchema.safeParse({ name: "A", brandColors: ["rouge"] }).success).toBe(false);
  });

  it("refuse un site sans protocole http", () => {
    expect(brandInputSchema.safeParse({ name: "A", website: "javascript:alert(1)" }).success).toBe(false);
  });

  it("signale les champs recommandés manquants", () => {
    const brand = brandInputSchema.parse({ name: "A", industry: "Restauration" });
    expect(missingRecommendedFields(brand)).not.toContain("industry");
    expect(missingRecommendedFields(brand)).toContain("description");
  });
});

describe("rôles", () => {
  it("un lecteur ne peut pas modifier la marque", () => {
    expect(roleHasPermission("viewer", "brand:write")).toBe(false);
  });
  it("seul le propriétaire gère la facturation", () => {
    expect(roleHasPermission("owner", "billing:manage")).toBe(true);
    expect(roleHasPermission("admin", "billing:manage")).toBe(false);
  });
});

describe("statuts de publication", () => {
  it("une publication publiée ne change plus d'état", () => {
    expect(canTransitionPost("published", "draft")).toBe(false);
  });
  it("une publication en échec peut être reprogrammée", () => {
    expect(canTransitionPost("failed", "scheduled")).toBe(true);
  });
});

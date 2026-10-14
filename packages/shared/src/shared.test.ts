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

describe("génération", () => {
  it("compose le texte avec des hashtags propres et uniques", async () => {
    const { composePostText } = await import("./index");
    expect(composePostText({ text: " Bonjour ", hashtags: ["#pain", "pain", "fait maison", ""] })).toBe(
      "Bonjour\n\n#pain #faitmaison",
    );
  });

  it("valide une demande de génération", async () => {
    const { generationRequestSchema } = await import("./index");
    const ok = generationRequestSchema.safeParse({
      brandId: "abc",
      networks: ["instagram", "linkedin"],
      brief: "Nouveau menu d'automne",
      requestId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    });
    expect(ok.success).toBe(true);
    expect(generationRequestSchema.safeParse({ brandId: "abc", networks: [], brief: "x", requestId: "1" }).success).toBe(false);
  });
});

describe("médias", () => {
  it("choisit une couleur de texte lisible", async () => {
    const { readableTextColor } = await import("./index");
    expect(readableTextColor("#ffffff")).toBe("#111111");
    expect(readableTextColor("#4f46e5")).toBe("#ffffff");
    expect(readableTextColor("#facc15")).toBe("#111111");
  });

  it("valide une demande de visuel", async () => {
    const { templateRenderSchema } = await import("./index");
    expect(templateRenderSchema.safeParse({ brandId: "a", templateId: "promo", format: "square", title: "Soldes" }).success).toBe(true);
    expect(templateRenderSchema.safeParse({ brandId: "a", templateId: "promo", format: "tiny", title: "Soldes" }).success).toBe(false);
  });
});

import { brandInputSchema } from "@smia/shared";
import { describe, expect, it } from "vitest";
import { buildUserPrompt, formatBrandSheet, SYSTEM_PROMPT } from "@/server/ai/prompt";

const brand = brandInputSchema.parse({
  name: "Boulangerie Martin",
  industry: "Boulangerie",
  pricesAndOffers: "Baguette 1,20 €",
  wordsToAvoid: ["industriel"],
});

describe("prompt de génération", () => {
  it("interdit explicitement d'inventer des informations", () => {
    expect(SYSTEM_PROMPT).toContain("N'invente jamais de prix");
    expect(SYSTEM_PROMPT).toContain("missingInformation");
  });

  it("n'inclut que les champs renseignés de la marque", () => {
    const sheet = formatBrandSheet(brand);
    expect(sheet).toContain("Prix et offres : Baguette 1,20 €");
    expect(sheet).toContain("Mots à éviter : industriel");
    expect(sheet).not.toContain("Promotions en cours");
  });

  it("donne la limite de caractères de chaque réseau demandé", () => {
    const prompt = buildUserPrompt({
      brand,
      networks: ["x", "linkedin"],
      kind: "promotion",
      brief: "Croissants à moitié prix samedi",
      tone: "chaleureux",
      variantsPerNetwork: 2,
    });
    expect(prompt).toContain("x (X (Twitter)) : 2 version(s), 280 caractères maximum");
    expect(prompt).toContain("linkedin (LinkedIn) : 2 version(s), 3000 caractères maximum");
    expect(prompt).toContain("<demande>");
    expect(prompt).not.toContain("instagram");
  });
});

describe("prompts de campagne", () => {
  it("impose les dates et interdit l'invention", async () => {
    const { buildStrategyPrompt, STRATEGY_SYSTEM_PROMPT } = await import("@/server/ai/prompt");
    expect(STRATEGY_SYSTEM_PROMPT).toContain("Les dates des publications sont imposées");
    const prompt = buildStrategyPrompt({
      brand,
      name: "Automne",
      objective: "evenement",
      networks: ["instagram"],
      highlights: "Soirée le 31",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      slots: [{ index: 0, date: "2026-11-02", weekday: "lundi" }],
    });
    expect(prompt).toContain("index 0 : lundi 2026-11-02");
    expect(prompt).toContain("Communiquer sur un événement");
  });
});

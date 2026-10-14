import { brandInputSchema } from "@smia/shared";
import { describe, expect, it } from "vitest";
import { brandFormDataToInput } from "@/lib/brand-form-data";

describe("brandFormDataToInput", () => {
  it("découpe les listes et produit une marque valide", () => {
    const form = new FormData();
    form.set("name", "Café du Port");
    form.set("wordsToUse", "fait maison, local\nconvivial");
    form.set("brandColors", "#112233, #AABBCC");
    form.set("contactEmail", "contact@cafe.fr");

    const brand = brandInputSchema.parse(brandFormDataToInput(form));
    expect(brand.wordsToUse).toEqual(["fait maison", "local", "convivial"]);
    expect(brand.brandColors).toEqual(["#112233", "#AABBCC"]);
    expect(brand.publicContact.email).toBe("contact@cafe.fr");
    expect(brand.timeZone).toBe("Europe/Paris");
  });

  it("rejette un fuseau horaire inconnu", () => {
    const form = new FormData();
    form.set("name", "A");
    form.set("timeZone", "Mars/Olympus");
    expect(brandInputSchema.safeParse(brandFormDataToInput(form)).success).toBe(false);
  });
});

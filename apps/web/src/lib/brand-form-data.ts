/**
 * Convertit les champs du formulaire « Ma marque » en objet à valider.
 * Les listes sont saisies séparées par des virgules ou des retours à la ligne.
 * La validation réelle est faite côté serveur par brandInputSchema.
 */
export function brandFormDataToInput(form: FormData): Record<string, unknown> {
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  const list = (name: string) =>
    text(name)
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);

  return {
    name: text("name"),
    industry: text("industry"),
    description: text("description"),
    website: text("website"),
    country: text("country"),
    timeZone: text("timeZone") || undefined,
    primaryLanguage: text("primaryLanguage") || undefined,
    secondaryLanguages: list("secondaryLanguages"),
    targetAudience: text("targetAudience"),
    geographicArea: text("geographicArea"),
    productsAndServices: text("productsAndServices"),
    pricesAndOffers: text("pricesAndOffers"),
    currentPromotions: text("currentPromotions"),
    competitiveAdvantages: text("competitiveAdvantages"),
    tone: text("tone") || undefined,
    writingStyle: text("writingStyle"),
    wordsToUse: list("wordsToUse"),
    wordsToAvoid: list("wordsToAvoid"),
    brandColors: list("brandColors"),
    allowedFonts: list("allowedFonts"),
    publicContact: {
      phone: text("contactPhone"),
      email: text("contactEmail"),
      address: text("contactAddress"),
    },
    preferredCallToAction: text("preferredCallToAction"),
  };
}

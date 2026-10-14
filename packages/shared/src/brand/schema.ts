import { z } from "zod";

/** Tons de communication proposés à l'utilisateur. */
export const BRAND_TONES = [
  "professionnel",
  "chaleureux",
  "direct",
  "humoristique",
  "premium",
  "pedagogique",
  "commercial",
] as const;

export type BrandTone = (typeof BRAND_TONES)[number];

export const BRAND_TONE_LABELS: Record<BrandTone, string> = {
  professionnel: "Professionnel",
  chaleureux: "Chaleureux",
  direct: "Direct",
  humoristique: "Humoristique",
  premium: "Premium",
  pedagogique: "Pédagogique",
  commercial: "Commercial",
};

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => trimmed(max).optional().default("");
const stringList = (maxItems: number, maxLength: number) =>
  z.array(trimmed(maxLength).min(1)).max(maxItems).default([]);

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Couleur attendue au format #RRGGBB");

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === "" || /^https?:\/\/\S+$/i.test(value), "Adresse web invalide")
  .optional()
  .default("");

/** Fuseau horaire IANA (ex. Europe/Paris), utilisé pour programmer et afficher les publications. */
export const timeZoneSchema = z
  .string()
  .trim()
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("fr-FR", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Fuseau horaire inconnu");

const languageCode = z
  .string()
  .trim()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, "Code langue attendu (ex. fr, en, fr-BE)");

/**
 * Données de la marque saisies par l'utilisateur.
 * C'est la « mémoire de marque » : l'IA s'appuie uniquement sur ces informations
 * et ne doit jamais inventer de prix, promotions ou coordonnées.
 */
export const brandInputSchema = z.object({
  name: trimmed(120).min(1, "Le nom de l'entreprise est obligatoire"),
  industry: optionalText(120),
  description: optionalText(2000),
  website: optionalUrl,
  country: optionalText(80),
  timeZone: timeZoneSchema.default("Europe/Paris"),
  primaryLanguage: languageCode.default("fr"),
  secondaryLanguages: z.array(languageCode).max(10).default([]),
  targetAudience: optionalText(1000),
  geographicArea: optionalText(300),
  productsAndServices: optionalText(3000),
  pricesAndOffers: optionalText(2000),
  currentPromotions: optionalText(1000),
  competitiveAdvantages: optionalText(1500),
  tone: z.enum(BRAND_TONES).default("chaleureux"),
  writingStyle: optionalText(1000),
  wordsToUse: stringList(50, 60),
  wordsToAvoid: stringList(50, 60),
  brandColors: z.array(hexColor).max(8).default([]),
  allowedFonts: stringList(5, 80),
  publicContact: z
    .object({
      phone: optionalText(40),
      email: z
        .string()
        .trim()
        .max(200)
        .refine((v) => v === "" || z.email().safeParse(v).success, "E-mail invalide")
        .optional()
        .default(""),
      address: optionalText(300),
    })
    .default({ phone: "", email: "", address: "" }),
  preferredCallToAction: optionalText(200),
});

export type BrandInput = z.infer<typeof brandInputSchema>;

/** Champs utiles à la génération qui, s'ils sont vides, doivent être signalés. */
export const BRAND_RECOMMENDED_FIELDS = [
  "industry",
  "description",
  "targetAudience",
  "productsAndServices",
  "preferredCallToAction",
] as const satisfies readonly (keyof BrandInput)[];

export const BRAND_FIELD_LABELS: Record<(typeof BRAND_RECOMMENDED_FIELDS)[number], string> = {
  industry: "Secteur d'activité",
  description: "Description de l'entreprise",
  targetAudience: "Public cible",
  productsAndServices: "Produits et services",
  preferredCallToAction: "Appel à l'action préféré",
};

/** Liste les champs recommandés encore vides, pour inviter l'utilisateur à les compléter. */
export function missingRecommendedFields(brand: BrandInput): (typeof BRAND_RECOMMENDED_FIELDS)[number][] {
  return BRAND_RECOMMENDED_FIELDS.filter((field) => brand[field].trim() === "");
}

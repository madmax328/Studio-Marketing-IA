import { z } from "zod";
import { POST_KINDS } from "../generation/schema";
import { SOCIAL_NETWORK_IDS } from "../social/networks";
import { DATE_PATTERN, daysBetween, TIME_PATTERN } from "../time/zoned";

export const CAMPAIGN_OBJECTIVES = [
  "notoriete",
  "promouvoir_produit",
  "annoncer_promotion",
  "clients_locaux",
  "visites_site",
  "demandes_devis",
  "communaute",
  "fidelisation",
  "lancement_produit",
  "evenement",
] as const;

export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number];

export const CAMPAIGN_OBJECTIVE_LABELS: Record<CampaignObjective, string> = {
  notoriete: "Faire connaître l'entreprise",
  promouvoir_produit: "Promouvoir un produit",
  annoncer_promotion: "Annoncer une promotion",
  clients_locaux: "Attirer des clients locaux",
  visites_site: "Obtenir des visites sur le site",
  demandes_devis: "Générer des demandes de devis",
  communaute: "Développer une communauté",
  fidelisation: "Fidéliser les clients",
  lancement_produit: "Lancer un nouveau produit",
  evenement: "Communiquer sur un événement",
};

export const CAMPAIGN_STATUSES = ["draft", "strategy", "validated", "archived"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "À préparer",
  strategy: "Stratégie proposée",
  validated: "Stratégie validée",
  archived: "Archivée",
};

export const MAX_CAMPAIGN_DAYS = 92;
export const MAX_CAMPAIGN_SLOTS = 60;

const dateString = z.string().regex(DATE_PATTERN, "Date invalide");
const timeString = z.string().regex(TIME_PATTERN, "Heure invalide (HH:MM)");

/** Assistant de création (étapes 1 à 6). */
export const campaignInputSchema = z
  .object({
    brandId: z.string().min(1, "Choisissez une marque"),
    name: z.string().trim().min(1, "Donnez un nom à la campagne").max(120),
    objective: z.enum(CAMPAIGN_OBJECTIVES),
    networks: z.array(z.enum(SOCIAL_NETWORK_IDS)).min(1, "Choisissez au moins un réseau").max(8),
    highlights: z.string().trim().max(3000).default(""),
    startDate: dateString,
    endDate: dateString,
    postsPerWeek: z.coerce.number().int().min(1).max(14),
    defaultTime: timeString.default("12:00"),
  })
  .refine((c) => daysBetween(c.startDate, c.endDate) >= 0, { message: "La date de fin doit suivre la date de début.", path: ["endDate"] })
  .refine((c) => daysBetween(c.startDate, c.endDate) < MAX_CAMPAIGN_DAYS, {
    message: `Une campagne dure au maximum ${MAX_CAMPAIGN_DAYS} jours.`,
    path: ["endDate"],
  });

export type CampaignInput = z.infer<typeof campaignInputSchema>;

/** Un créneau du plan : une date, un sujet, et une publication par réseau de la campagne. */
export const campaignSlotSchema = z.object({
  slotId: z.string().min(1).max(64),
  date: dateString,
  time: timeString,
  theme: z.string().trim().min(1, "Chaque publication doit avoir un sujet").max(300),
  kind: z.enum(POST_KINDS),
  role: z.string().trim().max(300).default(""),
});

export type CampaignSlot = z.infer<typeof campaignSlotSchema>;

/** Stratégie modifiable par l'utilisateur avant validation. */
export const campaignStrategySchema = z.object({
  summary: z.string().trim().max(3000).default(""),
  keyMessages: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  slots: z.array(campaignSlotSchema).min(1, "Le plan doit contenir au moins une publication").max(MAX_CAMPAIGN_SLOTS),
});

export type CampaignStrategy = z.infer<typeof campaignStrategySchema>;

/** Sortie attendue de l'IA pour la stratégie (les dates sont calculées par l'application, pas par l'IA). */
export const strategyOutputSchema = z.object({
  summary: z.string(),
  keyMessages: z.array(z.string()),
  slots: z.array(z.object({ index: z.number(), theme: z.string(), kind: z.enum(POST_KINDS), role: z.string() })),
  missingInformation: z.array(z.string()),
});

export type StrategyOutput = z.infer<typeof strategyOutputSchema>;

/** Sortie attendue de l'IA pour les publications d'un lot de créneaux. */
export const campaignPostsOutputSchema = z.object({
  posts: z.array(
    z.object({
      slotIndex: z.number(),
      network: z.enum(SOCIAL_NETWORK_IDS),
      text: z.string(),
      hashtags: z.array(z.string()),
      rationale: z.string(),
    }),
  ),
  missingInformation: z.array(z.string()),
});

export type CampaignPostsOutput = z.infer<typeof campaignPostsOutputSchema>;

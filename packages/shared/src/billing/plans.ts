/** Identifiants des offres. Leur contenu (limites, crédits, textes) est stocké en base et modifiable sans code. */
export const PLAN_IDS = ["free", "solo", "business", "agency"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanLimits {
  /** Marques gérées dans l'espace. */
  maxBrands: number;
  /** Crédits de génération IA par mois civil. */
  monthlyCredits: number;
  /** Comptes de réseaux sociaux réels connectés (les comptes de test ne comptent pas). */
  maxSocialAccounts: number;
  /** Personnes dans l'espace (propriétaire compris). */
  maxMembers: number;
  /** Espaces clients rattachés à l'abonnement (agences). */
  maxClientSpaces: number;
}

/**
 * Coût en crédits des opérations qui consomment un service payant (IA dans le cloud).
 * Les opérations exécutées sur notre infrastructure sans coût externe (visuels par gabarit,
 * programmation, publication) sont gratuites.
 */
export const CREDIT_COSTS = {
  text_generation: 1,
  campaign_strategy: 1,
  campaign_posts: 2,
  campaign_post_regeneration: 1,
  /** Une image créée par IA (plus coûteuse qu'un texte). */
  image_generation: 3,
  /** Voix off d'une vidéo (toutes ses diapositives). */
  voiceover: 1,
  /** Vidéo créée par IA (service coûteux, facturé à la seconde) : 4 s ou 8 s. */
  video_generation_4s: 12,
  video_generation_8s: 24,
} as const;

export type CreditOperation = keyof typeof CREDIT_COSTS;

/** Mois civil (UTC) servant de période de crédits : « 2026-10 ». */
export function creditPeriod(date: Date): string {
  return date.toISOString().slice(0, 7);
}

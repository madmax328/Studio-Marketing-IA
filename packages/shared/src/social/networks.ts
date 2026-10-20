/**
 * Catalogue des réseaux sociaux pris en charge par la V1.
 *
 * Ces données décrivent les contraintes connues de chaque plateforme. Elles
 * servent à adapter la génération (longueur, formats) et à afficher à
 * l'utilisateur ce qui est possible. Les limites des API changent souvent :
 * chaque entrée doit être revérifiée dans la documentation officielle avant la
 * mise en production (voir docs/SOCIAL_NETWORKS.md).
 */

export const SOCIAL_NETWORK_IDS = [
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
  "youtube",
  "x",
  "pinterest",
  "threads",
  "google_business",
] as const;

export type SocialNetworkId = (typeof SOCIAL_NETWORK_IDS)[number];

export type MediaKind = "text" | "image" | "carousel" | "video";

/**
 * État d'avancement de l'intégration dans notre produit.
 * - planned : architecture prévue, aucun appel réel à l'API.
 * - in_development : code d'intégration écrit, pas encore testé sur un vrai compte.
 * - available : testé de bout en bout sur un vrai compte.
 */
export type IntegrationStatus = "planned" | "in_development" | "available";

export interface SocialNetworkDefinition {
  id: SocialNetworkId;
  label: string;
  /** Formats de publication que l'API officielle permet de publier. */
  publishableMedia: readonly MediaKind[];
  /** Nombre maximal d'images dans une publication (0 : vidéo uniquement). */
  maxImages: number;
  /** Une publication sans média (texte seul) est-elle acceptée ? */
  allowsTextOnly: boolean;
  /** Longueur maximale du texte principal (légende, description…). */
  maxTextLength: number;
  /** Démarches officielles à obtenir avant de publier pour des tiers. */
  approvalRequirements: readonly string[];
  integrationStatus: IntegrationStatus;
}

export const SOCIAL_NETWORKS: Record<SocialNetworkId, SocialNetworkDefinition> = {
  facebook: {
    id: "facebook",
    label: "Facebook",
    publishableMedia: ["text", "image", "carousel", "video"],
    maxImages: 10,
    allowsTextOnly: true,
    maxTextLength: 63206,
    approvalRequirements: [
      "Application Meta avec vérification d'entreprise",
      "Validation (App Review) des permissions de publication sur les Pages",
    ],
    integrationStatus: "in_development",
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    publishableMedia: ["image", "carousel", "video"],
    maxImages: 10,
    allowsTextOnly: false,
    maxTextLength: 2200,
    approvalRequirements: [
      "Compte Instagram professionnel (Business ou Creator)",
      "Validation (App Review) de la permission de publication de contenu",
    ],
    integrationStatus: "in_development",
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    publishableMedia: ["text", "image", "video"],
    maxImages: 20,
    allowsTextOnly: true,
    maxTextLength: 3000,
    approvalRequirements: [
      "Profil personnel : produit « Share on LinkedIn » (libre accès)",
      "Page entreprise : accès à la Community Management API (sur demande)",
    ],
    integrationStatus: "in_development",
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    publishableMedia: ["image", "video"],
    maxImages: 35,
    allowsTextOnly: false,
    maxTextLength: 2200,
    approvalRequirements: [
      "Content Posting API",
      "Audit TikTok obligatoire : sans audit, les publications restent privées",
    ],
    integrationStatus: "in_development",
  },
  youtube: {
    id: "youtube",
    label: "YouTube",
    publishableMedia: ["video"],
    maxImages: 0,
    allowsTextOnly: false,
    maxTextLength: 5000,
    approvalRequirements: [
      "Projet Google Cloud avec YouTube Data API v3",
      "Audit Google : sans audit, les vidéos envoyées restent privées",
      "Quota journalier limité (un envoi de vidéo consomme une grande partie du quota)",
    ],
    integrationStatus: "in_development",
  },
  x: {
    id: "x",
    label: "X (Twitter)",
    publishableMedia: ["text", "image", "video"],
    maxImages: 4,
    allowsTextOnly: true,
    maxTextLength: 280,
    approvalRequirements: ["Accès à l'API X payant selon le volume : tarifs à vérifier"],
    integrationStatus: "in_development",
  },
  pinterest: {
    id: "pinterest",
    label: "Pinterest",
    publishableMedia: ["image", "video"],
    maxImages: 5,
    allowsTextOnly: false,
    maxTextLength: 500,
    approvalRequirements: [
      "Application Pinterest API v5",
      "Passage de l'accès d'essai à l'accès standard (sur validation)",
    ],
    integrationStatus: "in_development",
  },
  threads: {
    id: "threads",
    label: "Threads",
    publishableMedia: ["text", "image", "carousel", "video"],
    maxImages: 20,
    allowsTextOnly: true,
    maxTextLength: 500,
    approvalRequirements: ["Threads API (Meta) avec validation (App Review) de la publication"],
    integrationStatus: "in_development",
  },
  google_business: {
    id: "google_business",
    label: "Google Business Profile",
    publishableMedia: ["text", "image"],
    maxImages: 1,
    allowsTextOnly: true,
    maxTextLength: 1500,
    approvalRequirements: [
      "Projet Google Cloud avec les API Google Business Profile",
      "Demande d'accès aux API Business Profile (formulaire Google, réservé aux fiches vérifiées)",
    ],
    integrationStatus: "in_development",
  },
};

/**
 * Réseaux sur lesquels le studio sait publier une vidéo (connecteur écrit) : tous ceux qui acceptent la vidéo.
 * Un réseau ajouté plus tard n'y figure qu'une fois son connecteur vidéo écrit.
 */
export const STUDIO_VIDEO_NETWORKS: readonly SocialNetworkId[] = ["facebook", "instagram", "threads", "linkedin", "tiktok", "youtube", "pinterest", "x"];

export function getSocialNetwork(id: SocialNetworkId): SocialNetworkDefinition {
  return SOCIAL_NETWORKS[id];
}

export function isSocialNetworkId(value: string): value is SocialNetworkId {
  return (SOCIAL_NETWORK_IDS as readonly string[]).includes(value);
}

/** Vérifie uniquement la longueur du texte. Retourne le problème en français, ou null. */
export function checkTextLength(networkId: SocialNetworkId, text: string): string | null {
  const network = SOCIAL_NETWORKS[networkId];
  return text.length > network.maxTextLength
    ? `Le texte dépasse la limite de ${network.label} (${text.length} / ${network.maxTextLength} caractères).`
    : null;
}

/**
 * Vérifie qu'un contenu respecte les contraintes connues d'un réseau.
 * Retourne la liste des problèmes en français (vide si tout est conforme).
 */
export function checkContentCompatibility(
  networkId: SocialNetworkId,
  content: { text: string; media: readonly MediaKind[] },
): string[] {
  const network = SOCIAL_NETWORKS[networkId];
  const problems: string[] = [];

  const lengthProblem = checkTextLength(networkId, content.text);
  if (lengthProblem) problems.push(lengthProblem);

  if (content.media.length === 0 && !network.allowsTextOnly) {
    problems.push(`${network.label} exige une image ou une vidéo.`);
  }

  for (const kind of content.media) {
    if (!network.publishableMedia.includes(kind)) {
      problems.push(`${network.label} ne permet pas de publier ce format : ${kind}.`);
    }
  }

  return problems;
}

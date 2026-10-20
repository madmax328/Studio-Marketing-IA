/**
 * Informations légales de l'éditeur, affichées dans les pages légales.
 * À compléter dès l'immatriculation de l'entreprise : un champ vide s'affiche « en cours ».
 * (Pas de secret ici : ces informations sont publiques par nature.)
 */
export const LEGAL = {
  serviceName: "Studio Marketing IA",
  /** Raison sociale (ex. « Studio Marketing IA SAS »). */
  companyName: "",
  /** Forme juridique et capital (ex. « SAS au capital de 1 000 € »). */
  legalForm: "",
  siret: "",
  /** Ville du registre (ex. « RCS Paris »). */
  rcs: "",
  vatNumber: "",
  address: "",
  publicationDirector: "",
  /** Adresse de contact pour les questions et l'exercice des droits RGPD. */
  contactEmail: "",
  /** Médiateur de la consommation (obligatoire pour vendre à des particuliers). */
  mediator: { name: "", url: "" },
  /** Date de dernière mise à jour des documents (AAAA-MM-JJ). */
  lastUpdated: "2026-10-20",
} as const;

export const HOSTING = {
  name: "Vercel Inc.",
  address: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
  url: "https://vercel.com",
};

/** Sous-traitants qui traitent des données pour le compte du service. */
export const SUBPROCESSORS = [
  { name: "Vercel Inc.", role: "Hébergement de l'application et stockage des fichiers (Vercel Blob)", location: "États-Unis / Union européenne" },
  { name: "MongoDB Inc. (Atlas)", role: "Base de données", location: "Selon la région du serveur choisie" },
  { name: "Anthropic PBC", role: "Rédaction par intelligence artificielle, uniquement après votre accord", location: "États-Unis" },
  { name: "OpenAI, L.L.C.", role: "Création d'images, de voix off et de vidéos par intelligence artificielle, uniquement après votre accord", location: "États-Unis" },
  { name: "Stripe Payments Europe Ltd", role: "Paiement et gestion des abonnements", location: "Union européenne / États-Unis" },
  { name: "Hostinger International Ltd / Resend", role: "Envoi des e-mails du service", location: "Union européenne / États-Unis" },
  { name: "Meta, LinkedIn et les autres réseaux connectés", role: "Publication et statistiques, uniquement pour les comptes que vous connectez", location: "Selon le réseau" },
] as const;

/** Valeur à afficher, ou mention d'attente tant que l'information n'est pas disponible. */
export function legalValue(value: string, pending = "en cours d'immatriculation"): string {
  return value.trim() || `(${pending})`;
}

/** Nom de l'éditeur tel qu'il apparaît dans les textes. */
export function publisherName(): string {
  return LEGAL.companyName.trim() || `${LEGAL.serviceName} (société en cours d'immatriculation)`;
}

export function legalDate(): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${LEGAL.lastUpdated}T12:00:00Z`));
}

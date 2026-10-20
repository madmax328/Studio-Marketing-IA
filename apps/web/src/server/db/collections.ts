import type { Db, ObjectId } from "mongodb";
import type { EncryptedValue } from "@/server/security/crypto";
import type {
  BenchmarkGroup,
  BrandInput,
  CampaignObjective,
  CampaignStatus,
  CampaignStrategy,
  CreditOperation,
  InvitableRole,
  PlanId,
  PlanLimits,
  PostMetrics,
  PostStatus,
  TestimonialStatus,
  SocialNetworkId,
  WorkspaceRole,
} from "@smia/shared";

/**
 * Types des documents MongoDB de l'application.
 * Les collections d'authentification (user, session, account, verification)
 * sont gérées par Better Auth et ne sont pas décrites ici.
 * Toutes les dates sont stockées en UTC (objets Date).
 */

export interface WorkspaceDoc {
  _id: ObjectId;
  name: string;
  /** Identifiant Better Auth du créateur de l'espace. */
  ownerUserId: string;
  /** Espace personnel créé automatiquement pour chaque utilisateur. */
  personal: boolean;
  /** Anciennes limites (avant les offres) : ignorées, retirées par la migration 006. */
  limits?: unknown;
  /** Dérogations aux limites de l'offre pour cet espace (geste commercial, tests). */
  limitOverrides?: Partial<PlanLimits>;
  /** Accord donné pour envoyer les données de la marque à un fournisseur d'IA externe (RGPD). */
  aiConsent?: { provider: string; acceptedAt: Date; acceptedByUserId: string };
  /** Accords par fournisseur d'IA (texte, images…), indépendants les uns des autres. */
  aiConsents?: Record<string, { acceptedAt: Date; acceptedByUserId: string }>;
  /** Espace client d'une agence : abonnement et crédits sont ceux de l'espace de l'agence. */
  billingWorkspaceId?: ObjectId | null;
  /** Les publications des rédacteurs doivent être validées avant d'être programmées. */
  approvalRequired?: boolean;
  /** Participation aux repères anonymes entre comptes (vrai par défaut ; false = l'espace s'est retiré). */
  benchmarkSharing?: boolean;
  schemaVersion: 1;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMemberDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  userId: string;
  role: WorkspaceRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrandDoc extends BrandInput {
  _id: ObjectId;
  /** Logo choisi dans la médiathèque. */
  logoMediaId?: ObjectId | null;
  workspaceId: ObjectId;
  createdByUserId: string;
  schemaVersion: 1;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  brandId: ObjectId;
  network: SocialNetworkId;
  status: PostStatus;
  text: string;
  /** Rôle de la publication expliqué par l'IA. */
  rationale: string;
  /** Génération d'origine, si la publication a été créée par l'IA. */
  generationJobId: ObjectId | null;
  /** Campagne d'origine et créneau du plan, si la publication vient d'une campagne. */
  campaignId?: ObjectId | null;
  slotId?: string | null;
  /** Médias joints, dans l'ordre d'affichage. Absent sur les anciennes publications. */
  mediaIds?: ObjectId[];
  /** Nature des médias joints : des images, ou une seule vidéo (null ou absent : aucun média). */
  mediaKind?: "image" | "video" | null;
  /** Date prévue en UTC. */
  scheduledAt: Date | null;
  /** Fuseau de l'utilisateur au moment de la programmation, pour l'affichage et les changements d'heure. */
  timeZone: string;
  publishedAt: Date | null;
  /** Compte choisi pour l'envoi ; nécessaire seulement si plusieurs comptes du réseau sont connectés. */
  socialAccountId?: ObjectId | null;
  /** Suivi de l'envoi (absent tant que la publication n'a jamais été traitée). */
  publishing?: PostPublishing;
  /** Derniers chiffres relevés sur le réseau (publications réelles uniquement). */
  metrics?: PostMetricsState;
  /** Validation avant programmation (espaces où elle est exigée). */
  approval?: PostApproval | null;
  schemaVersion: 1;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostApproval {
  requestedByUserId: string;
  requestedAt: Date;
  decision: "pending" | "approved" | "rejected";
  decidedByUserId: string | null;
  decidedAt: Date | null;
  /** Remarque de la personne qui a refusé (affichée au rédacteur). */
  comment: string | null;
}

/** Invitation à rejoindre un espace (lien à usage unique envoyé par e-mail ; seul son empreinte est gardée). */
export interface WorkspaceInvitationDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  email: string;
  role: InvitableRole;
  tokenHash: string;
  invitedByUserId: string;
  expiresAt: Date;
  createdAt: Date;
}

/** Repères anonymes entre comptes (un seul document, recalculé chaque jour). Aucun identifiant de compte. */
export interface BenchmarkDoc {
  _id: "global";
  groups: BenchmarkGroup[];
  /** Comptes participants ayant au moins une publication mesurée. */
  participants: number;
  computedAt: Date;
}

export interface PostPublishing {
  attempts: number;
  /** Prochaine tentative après une erreur temporaire. */
  nextAttemptAt: Date | null;
  /** Verrou posé par le traitement en cours (évite deux envois simultanés). */
  lockedAt: Date | null;
  lockId: string | null;
  socialAccountId: ObjectId | null;
  externalId: string | null;
  externalUrl: string | null;
  /** Vrai si la publication a été « envoyée » en mode simulation : rien n'est parti sur le réseau. */
  simulated: boolean;
  lastError: string | null;
  lastAttemptAt: Date | null;
  /** Reprise d'un envoi en cours chez le réseau (vidéo en traitement) ; effacée à chaque modification. */
  resume?: Record<string, string> | null;
}

export interface PostMetricsState {
  values: PostMetrics;
  /** Dernier relevé réussi ; null tant qu'aucun relevé n'a abouti. */
  collectedAt: Date | null;
  /** Prochain relevé prévu ; null quand le suivi est terminé. */
  nextCollectAt: Date | null;
  /** Le réseau ne fournit pas de chiffres pour ce compte (ou pas encore via notre connecteur). */
  unsupported: boolean;
  lastError: string | null;
  attempts: number;
}

/** Relevé des chiffres d'une publication à un instant donné (historique). */
export interface AnalyticsSnapshotDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  postId: ObjectId;
  brandId: ObjectId;
  network: SocialNetworkId;
  collectedAt: Date;
  values: PostMetrics;
}

/** Avis d'un utilisateur (un par compte). */
export interface TestimonialDoc {
  _id: ObjectId;
  userId: string;
  workspaceId: ObjectId;
  rating: number;
  text: string;
  authorName: string;
  authorRole: string;
  city: string;
  /** Accord explicite pour une publication sur le site. */
  publishConsent: boolean;
  status: TestimonialStatus;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Compte social connecté. Les jetons sont toujours chiffrés (AES-256-GCM). */
export interface SocialAccountDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  network: SocialNetworkId;
  /** Connecteur utilisé : réseau réel ou simulation (aucun envoi). */
  provider: OAuthProviderId | "simulation";
  /** Identifiant du compte, de la page ou du profil chez le réseau. */
  externalAccountId: string;
  displayName: string;
  status: "connected" | "expired" | "revoked" | "error";
  scopes: string[];
  accessToken: EncryptedValue | null;
  refreshToken: EncryptedValue | null;
  tokenExpiresAt: Date | null;
  /** Prévenu que l'autorisation arrive à expiration (une seule alerte par connexion). */
  expiryWarnedAt?: Date | null;
  lastCheckedAt: Date | null;
  lastError: string | null;
  connectedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Fournisseurs de connexion OAuth (Threads a ses propres identifiants, distincts de Facebook Login). */
export type OAuthProviderId = "meta" | "threads" | "linkedin" | "tiktok" | "youtube" | "pinterest" | "x" | "google_business";

/** Compte proposé après l'autorisation, en attente du choix de l'utilisateur. Jeton chiffré. */
export interface PendingSocialAccount {
  /** Clé de sélection : `${network}:${externalAccountId}`. */
  key: string;
  network: SocialNetworkId;
  externalAccountId: string;
  displayName: string;
  scopes: string[];
  accessToken: EncryptedValue;
  /** Jeton de renouvellement (réseaux à jetons courts : TikTok, Google, Pinterest, X). */
  refreshToken?: EncryptedValue | null;
  tokenExpiresAt: Date | null;
}

/**
 * État OAuth en cours (protection CSRF), à usage unique et de courte durée.
 * Après le retour du réseau, il garde les comptes proposés jusqu'au choix de l'utilisateur.
 */
export interface OAuthStateDoc {
  _id: string;
  workspaceId: ObjectId;
  userId: string;
  provider: OAuthProviderId;
  codeVerifier: string | null;
  pending?: { candidates: PendingSocialAccount[]; receivedAt: Date };
  expiresAt: Date;
  createdAt: Date;
}

export interface NotificationDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  kind:
    | "publish_failed"
    | "publish_succeeded"
    | "account_expired"
    | "account_expiring"
    | "payment_failed"
    | "approval_requested"
    | "approval_decided";
  title: string;
  body: string;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface CampaignDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  brandId: ObjectId;
  createdByUserId: string;
  name: string;
  objective: CampaignObjective;
  networks: SocialNetworkId[];
  highlights: string;
  /** Dates locales (YYYY-MM-DD) dans le fuseau de la campagne. */
  startDate: string;
  endDate: string;
  postsPerWeek: number;
  defaultTime: string;
  timeZone: string;
  status: CampaignStatus;
  strategy: CampaignStrategy | null;
  missingInformation: string[];
  schemaVersion: 1;
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaAssetDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  brandId: ObjectId | null;
  createdByUserId: string;
  kind: "image" | "video";
  /** Origine : envoyé par l'utilisateur ou créé avec un gabarit. */
  source: "upload" | "template" | "ai";
  name: string;
  /** Type réel détecté côté serveur (pas celui annoncé par le navigateur). */
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "video/mp4";
  size: number;
  width: number;
  height: number;
  /** Chemin dans le stockage objet ; toujours préfixé par ws/<workspaceId>/. */
  storageKey: string;
  /** Vidéos : durée et image d'aperçu (JPEG). */
  durationSeconds?: number;
  posterStorageKey?: string | null;
  status: "ready";
  createdAt: Date;
  updatedAt: Date;
}

/** Offre commerciale. Modifiable en base sans changer le code ; le prix vient de Stripe. */
export interface PlanDoc {
  _id: PlanId;
  name: string;
  description: string;
  features: string[];
  /** Limites stockées ; les limites d'équipe peuvent manquer sur les offres créées avant la migration 012. */
  limits: Omit<PlanLimits, "maxMembers" | "maxClientSpaces"> & Partial<Pick<PlanLimits, "maxMembers" | "maxClientSpaces">>;
  /** Ordre d'affichage. */
  order: number;
  active: boolean;
  updatedAt: Date;
}

/** Abonnement d'un espace (un document par espace, _id = workspaceId). */
export interface SubscriptionDoc {
  _id: ObjectId;
  planId: PlanId;
  status: "active" | "trialing" | "past_due" | "unpaid" | "canceled" | "incomplete" | "incomplete_expired" | "paused";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  /** Date de l'événement Stripe appliqué en dernier (ignore les événements arrivés en retard). */
  lastEventAt: Date | null;
  updatedAt: Date;
}

/** Solde de crédits d'un espace pour un mois civil. */
export interface CreditAccountDoc {
  /** `${workspaceId}:${period}` */
  _id: string;
  workspaceId: ObjectId;
  period: string;
  allowance: number;
  used: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Mouvement de crédits : journal immuable (on n'y fait que des insertions). */
export interface CreditTransactionDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  period: string;
  /** Négatif pour une consommation, positif pour un remboursement. */
  amount: number;
  kind: "charge" | "refund";
  operation: CreditOperation;
  /** Clé unique par espace : empêche de compter deux fois la même opération. */
  idempotencyKey: string;
  generationJobId: ObjectId | null;
  /** Espace client à l'origine de l'opération (crédits de l'agence). */
  sourceWorkspaceId?: ObjectId;
  createdAt: Date;
}

/** Événements Stripe déjà traités (les webhooks peuvent être renvoyés plusieurs fois). */
export interface StripeEventDoc {
  _id: string;
  type: string;
  processedAt: Date;
}

export interface GenerationJobDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  brandId: ObjectId;
  userId: string;
  /** Identifiant fourni par le navigateur : une même demande n'est générée (et comptée) qu'une fois. */
  requestId: string;
  kind: "text" | "campaign_strategy" | "campaign_posts" | "image" | "voiceover" | "video";
  campaignId?: ObjectId;
  provider: string;
  model: string | null;
  status: "processing" | "succeeded" | "failed";
  /** Paramètres de la demande (sans données personnelles supplémentaires). */
  request: Record<string, unknown>;
  /** Sortie validée du fournisseur ; sa forme dépend de `kind`. */
  result: unknown;
  error: string | null;
  usage: { inputTokens: number; outputTokens: number } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogDoc {
  _id: ObjectId;
  workspaceId: ObjectId | null;
  actorUserId: string | null;
  action: string;
  targetId: string | null;
  /** Ne jamais y placer de secret, de jeton ou de contenu privé. */
  metadata: Record<string, string | number | boolean | null>;
  createdAt: Date;
}

export interface MigrationDoc {
  _id: string;
  appliedAt: Date;
}

export const COLLECTIONS = {
  workspaces: "workspaces",
  workspaceMembers: "workspaceMembers",
  brands: "brands",
  posts: "posts",
  socialAccounts: "socialAccounts",
  auditLogs: "auditLogs",
  generationJobs: "generationJobs",
  mediaAssets: "mediaAssets",
  campaigns: "campaigns",
  oauthStates: "oauthStates",
  notifications: "notifications",
  plans: "plans",
  subscriptions: "subscriptions",
  creditAccounts: "creditAccounts",
  creditTransactions: "creditTransactions",
  stripeEvents: "stripeEvents",
  analyticsSnapshots: "analyticsSnapshots",
  testimonials: "testimonials",
  workspaceInvitations: "workspaceInvitations",
  benchmarks: "benchmarks",
  migrations: "migrations",
} as const;

export function collections(db: Db) {
  return {
    workspaces: db.collection<WorkspaceDoc>(COLLECTIONS.workspaces),
    workspaceMembers: db.collection<WorkspaceMemberDoc>(COLLECTIONS.workspaceMembers),
    brands: db.collection<BrandDoc>(COLLECTIONS.brands),
    posts: db.collection<PostDoc>(COLLECTIONS.posts),
    socialAccounts: db.collection<SocialAccountDoc>(COLLECTIONS.socialAccounts),
    auditLogs: db.collection<AuditLogDoc>(COLLECTIONS.auditLogs),
    generationJobs: db.collection<GenerationJobDoc>(COLLECTIONS.generationJobs),
    mediaAssets: db.collection<MediaAssetDoc>(COLLECTIONS.mediaAssets),
    campaigns: db.collection<CampaignDoc>(COLLECTIONS.campaigns),
    oauthStates: db.collection<OAuthStateDoc>(COLLECTIONS.oauthStates),
    notifications: db.collection<NotificationDoc>(COLLECTIONS.notifications),
    plans: db.collection<PlanDoc>(COLLECTIONS.plans),
    subscriptions: db.collection<SubscriptionDoc>(COLLECTIONS.subscriptions),
    creditAccounts: db.collection<CreditAccountDoc>(COLLECTIONS.creditAccounts),
    creditTransactions: db.collection<CreditTransactionDoc>(COLLECTIONS.creditTransactions),
    stripeEvents: db.collection<StripeEventDoc>(COLLECTIONS.stripeEvents),
    analyticsSnapshots: db.collection<AnalyticsSnapshotDoc>(COLLECTIONS.analyticsSnapshots),
    testimonials: db.collection<TestimonialDoc>(COLLECTIONS.testimonials),
    workspaceInvitations: db.collection<WorkspaceInvitationDoc>(COLLECTIONS.workspaceInvitations),
    benchmarks: db.collection<BenchmarkDoc>(COLLECTIONS.benchmarks),
    migrations: db.collection<MigrationDoc>(COLLECTIONS.migrations),
  };
}

export type Collections = ReturnType<typeof collections>;

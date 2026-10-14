import type { Db, ObjectId } from "mongodb";
import type {
  BrandInput,
  GenerationOutput,
  GenerationRequest,
  PostStatus,
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
  /** Limites de l'offre. Configurables en base, jamais codées en dur dans l'interface. */
  limits: { maxBrands: number; monthlyTextGenerations?: number };
  /** Accord donné pour envoyer les données de la marque à un fournisseur d'IA externe (RGPD). */
  aiConsent?: { provider: string; acceptedAt: Date; acceptedByUserId: string };
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
  workspaceId: ObjectId;
  createdByUserId: string;
  schemaVersion: 1;
  createdAt: Date;
  updatedAt: Date;
}

/** Définition minimale : la programmation complète arrive avec le calendrier. */
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
  /** Date prévue en UTC. */
  scheduledAt: Date | null;
  /** Fuseau de l'utilisateur au moment de la programmation, pour l'affichage et les changements d'heure. */
  timeZone: string;
  publishedAt: Date | null;
  schemaVersion: 1;
  createdAt: Date;
  updatedAt: Date;
}

/** Définition minimale : les jetons OAuth chiffrés arrivent avec les intégrations. */
export interface SocialAccountDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  network: SocialNetworkId;
  status: "connected" | "expired" | "revoked" | "error";
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerationJobDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  brandId: ObjectId;
  userId: string;
  /** Identifiant fourni par le navigateur : une même demande n'est générée (et comptée) qu'une fois. */
  requestId: string;
  kind: "text";
  provider: string;
  model: string | null;
  status: "processing" | "succeeded" | "failed";
  request: Omit<GenerationRequest, "requestId" | "brandId">;
  result: GenerationOutput | null;
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
    migrations: db.collection<MigrationDoc>(COLLECTIONS.migrations),
  };
}

export type Collections = ReturnType<typeof collections>;

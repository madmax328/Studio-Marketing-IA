import { randomBytes } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { SOCIAL_NETWORKS, type SocialNetworkId } from "@smia/shared";
import { collections, type OAuthProviderId, type OAuthStateDoc, type PendingSocialAccount } from "@/server/db/collections";
import { encryptSecret } from "@/server/security/crypto";
import { OAUTH_STATE_TTL_SECONDS, type OAuthCandidate } from "@/server/social/oauth";
import { recordAudit } from "@/server/services/audit";
import { getEffectivePlan } from "@/server/services/billing";
import { UserFacingError } from "@/server/services/errors";
import { assertPermission } from "@/server/services/permissions";
import { getWorkspaceAccess, type WorkspaceAccess } from "@/server/services/workspaces";

/** Temps laissé pour choisir les comptes après l'autorisation. */
export const OAUTH_CHOICE_TTL_MINUTES = 15;

const accountKey = (network: SocialNetworkId, externalAccountId: string) => `${network}:${externalAccountId}`;

/** Comptes réels de l'espace (les comptes de test ne comptent pas dans la limite de l'offre). */
async function realAccounts(db: Db, workspaceId: ObjectId) {
  return collections(db)
    .socialAccounts.find({ workspaceId, provider: { $ne: "simulation" } }, { projection: { network: 1, externalAccountId: 1 } })
    .toArray();
}

function limitMessage(limit: number): string {
  return `Votre offre permet ${limit} compte${limit > 1 ? "s" : ""} connecté${limit > 1 ? "s" : ""} (hors comptes de test). Déconnectez un compte ou passez à une offre supérieure.`;
}

/** Ouvre une demande de connexion et retourne l'état OAuth à transmettre au réseau. */
export async function startOAuthConnection(db: Db, access: WorkspaceAccess, userId: string, provider: OAuthProviderId, now = new Date()): Promise<string> {
  assertPermission(access, "social:connect");
  const { limits } = await getEffectivePlan(db, access.workspace);
  const existing = await realAccounts(db, access.workspace._id);
  // À la limite, la reconnexion d'un compte existant reste possible : le choix final est vérifié à la confirmation.
  if (existing.length === 0 && limits.maxSocialAccounts <= 0) {
    throw new UserFacingError(limitMessage(limits.maxSocialAccounts), "limit_reached");
  }
  const state: OAuthStateDoc = {
    _id: randomBytes(32).toString("base64url"),
    workspaceId: access.workspace._id,
    userId,
    provider,
    codeVerifier: null,
    expiresAt: new Date(now.getTime() + OAUTH_STATE_TTL_SECONDS * 1000),
    createdAt: now,
  };
  await collections(db).oauthStates.insertOne(state);
  return state._id;
}

/**
 * Retour du réseau : vérifie l'état (même utilisateur, même fournisseur, non expiré, non utilisé),
 * revérifie les droits sur l'espace, échange le code puis garde les comptes proposés, jetons chiffrés.
 */
export async function receiveOAuthCallback(
  db: Db,
  params: {
    stateId: string;
    userId: string;
    provider: OAuthProviderId;
    encryptionKey: string;
    exchange: () => Promise<OAuthCandidate[]>;
    now?: Date;
  },
): Promise<void> {
  const now = params.now ?? new Date();
  const c = collections(db);
  const state = await c.oauthStates.findOne({
    _id: params.stateId,
    userId: params.userId,
    provider: params.provider,
    pending: { $exists: false },
    expiresAt: { $gt: now },
  });
  if (!state) throw new UserFacingError("La demande de connexion a expiré ou a déjà été utilisée. Recommencez.", "conflict");
  const access = await getWorkspaceAccess(db, params.userId, state.workspaceId.toHexString());
  if (!access) throw new UserFacingError("Vous n'avez plus accès à cet espace.", "forbidden");
  assertPermission(access, "social:connect");

  const seen = new Set<string>();
  const candidates: PendingSocialAccount[] = [];
  for (const candidate of await params.exchange()) {
    const key = accountKey(candidate.network, candidate.externalAccountId);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      key,
      network: candidate.network,
      externalAccountId: candidate.externalAccountId,
      displayName: candidate.displayName.slice(0, 120),
      scopes: candidate.scopes.slice(0, 30),
      accessToken: encryptSecret(candidate.accessToken, params.encryptionKey),
      tokenExpiresAt: candidate.tokenExpiresAt,
    });
  }

  const result = await c.oauthStates.updateOne(
    { _id: state._id, pending: { $exists: false } },
    { $set: { pending: { candidates, receivedAt: now }, expiresAt: new Date(now.getTime() + OAUTH_CHOICE_TTL_MINUTES * 60_000) } },
  );
  if (result.modifiedCount === 0) throw new UserFacingError("La demande de connexion a déjà été utilisée. Recommencez.", "conflict");
}

export interface PendingConnectionView {
  provider: OAuthProviderId;
  candidates: { key: string; network: SocialNetworkId; displayName: string; alreadyConnected: boolean }[];
  limit: number;
  used: number;
}

/** Comptes proposés, sans jeton, pour l'écran de choix. */
export async function getPendingConnection(db: Db, access: WorkspaceAccess, userId: string, stateId: string, now = new Date()): Promise<PendingConnectionView> {
  assertPermission(access, "social:connect");
  const state = await findPendingState(db, access, userId, stateId, now);
  const existing = await realAccounts(db, access.workspace._id);
  const existingKeys = new Set(existing.map((account) => accountKey(account.network, account.externalAccountId)));
  const { limits } = await getEffectivePlan(db, access.workspace);
  return {
    provider: state.provider,
    candidates: (state.pending?.candidates ?? []).map((candidate) => ({
      key: candidate.key,
      network: candidate.network,
      displayName: candidate.displayName,
      alreadyConnected: existingKeys.has(candidate.key),
    })),
    limit: limits.maxSocialAccounts,
    used: existing.length,
  };
}

async function findPendingState(db: Db, access: WorkspaceAccess, userId: string, stateId: string, now: Date): Promise<OAuthStateDoc> {
  const state =
    typeof stateId === "string" && stateId.length <= 100
      ? await collections(db).oauthStates.findOne({
          _id: stateId,
          userId,
          workspaceId: access.workspace._id,
          pending: { $exists: true },
          expiresAt: { $gt: now },
        })
      : null;
  if (!state) throw new UserFacingError("Cette demande de connexion a expiré. Recommencez depuis « Réseaux sociaux ».", "not_found");
  return state;
}

/**
 * Enregistre les comptes choisis (jetons chiffrés). Un compte déjà connecté est simplement
 * mis à jour (reconnexion) et ne compte pas deux fois dans la limite de l'offre.
 */
export async function confirmOAuthConnection(
  db: Db,
  access: WorkspaceAccess,
  userId: string,
  stateId: string,
  rawKeys: unknown,
  now = new Date(),
): Promise<number> {
  assertPermission(access, "social:connect");
  const keys = new Set(Array.isArray(rawKeys) ? rawKeys.filter((key): key is string => typeof key === "string") : []);
  const state = await findPendingState(db, access, userId, stateId, now);
  const selected = (state.pending?.candidates ?? []).filter((candidate) => keys.has(candidate.key));
  if (selected.length === 0) throw new UserFacingError("Choisissez au moins un compte à connecter.", "invalid_input");

  const existing = await realAccounts(db, access.workspace._id);
  const existingKeys = new Set(existing.map((account) => accountKey(account.network, account.externalAccountId)));
  const added = selected.filter((candidate) => !existingKeys.has(candidate.key)).length;
  const { limits } = await getEffectivePlan(db, access.workspace);
  if (existing.length + added > limits.maxSocialAccounts) throw new UserFacingError(limitMessage(limits.maxSocialAccounts), "limit_reached");

  // Usage unique : une seconde validation de la même demande échoue.
  const consumed = await collections(db).oauthStates.findOneAndDelete({ _id: state._id, workspaceId: access.workspace._id, userId });
  if (!consumed) throw new UserFacingError("Cette demande de connexion a déjà été utilisée.", "conflict");

  for (const candidate of selected) {
    await collections(db).socialAccounts.updateOne(
      { workspaceId: access.workspace._id, network: candidate.network, externalAccountId: candidate.externalAccountId },
      {
        $set: {
          provider: state.provider,
          displayName: candidate.displayName,
          status: "connected",
          scopes: candidate.scopes,
          accessToken: candidate.accessToken,
          refreshToken: null,
          tokenExpiresAt: candidate.tokenExpiresAt,
          expiryWarnedAt: null,
          lastCheckedAt: now,
          lastError: null,
          connectedByUserId: userId,
          updatedAt: now,
        },
        $setOnInsert: { _id: new ObjectId(), createdAt: now },
      },
      { upsert: true },
    );
    await recordAudit(db, {
      workspaceId: access.workspace._id,
      actorUserId: userId,
      action: "social.connected",
      metadata: { network: candidate.network, provider: state.provider },
    });
  }
  return selected.length;
}

export function networkLabels(networks: readonly SocialNetworkId[]): string {
  return networks.map((network) => SOCIAL_NETWORKS[network].label).join(" et ");
}

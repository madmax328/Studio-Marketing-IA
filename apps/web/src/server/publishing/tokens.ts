import type { Db } from "mongodb";
import { collections, type SocialAccountDoc } from "@/server/db/collections";
import { decryptSecret, encryptSecret } from "@/server/security/crypto";
import type { Notifier } from "./dispatcher";

/** Alerte envoyée quand une autorisation expire dans moins de 7 jours. */
export const EXPIRY_WARNING_DAYS = 7;
/** Les jetons Threads sont renouvelés automatiquement 10 jours avant leur expiration. */
export const THREADS_REFRESH_DAYS = 10;

export interface ExpiryNotifier {
  accountExpiring(account: SocialAccountDoc): Promise<void>;
}

export interface TokenMaintenanceDeps {
  db: Db;
  encryptionKey: string | undefined;
  notifier: Pick<Notifier, "accountExpired"> & ExpiryNotifier;
  /** Renouvellement d'un jeton Threads ; lève une erreur si Threads refuse. */
  refreshThreads?: (token: string, now: Date) => Promise<{ accessToken: string; tokenExpiresAt: Date | null }>;
  now?: Date;
}

const DAY = 24 * 60 * 60_000;

/**
 * Entretien des autorisations, à chaque passage du planificateur :
 * renouvelle les jetons Threads, prévient avant expiration, marque les comptes expirés.
 */
export async function maintainSocialTokens(deps: TokenMaintenanceDeps): Promise<{ refreshed: number; warned: number; expired: number }> {
  const now = deps.now ?? new Date();
  const c = collections(deps.db);
  const summary = { refreshed: 0, warned: 0, expired: 0 };

  if (deps.refreshThreads && deps.encryptionKey) {
    const due = await c.socialAccounts
      .find({
        provider: "threads",
        status: "connected",
        tokenExpiresAt: { $gt: now, $lte: new Date(now.getTime() + THREADS_REFRESH_DAYS * DAY) },
        // Threads n'accepte le renouvellement que pour un jeton de plus de 24 heures.
        updatedAt: { $lte: new Date(now.getTime() - DAY) },
        accessToken: { $ne: null },
      })
      .limit(20)
      .toArray();
    for (const account of due) {
      try {
        const refreshed = await deps.refreshThreads(decryptSecret(account.accessToken as NonNullable<SocialAccountDoc["accessToken"]>, deps.encryptionKey), now);
        await c.socialAccounts.updateOne(
          { _id: account._id, status: "connected" },
          {
            $set: {
              accessToken: encryptSecret(refreshed.accessToken, deps.encryptionKey),
              tokenExpiresAt: refreshed.tokenExpiresAt,
              expiryWarnedAt: null,
              lastCheckedAt: now,
              updatedAt: now,
            },
          },
        );
        summary.refreshed += 1;
      } catch (error) {
        // Nouvel essai au prochain passage ; l'alerte d'expiration prendra le relais si cela persiste.
        console.error("Renouvellement du jeton Threads impossible", error instanceof Error ? error.message : "erreur inconnue");
        await c.socialAccounts.updateOne({ _id: account._id }, { $set: { lastCheckedAt: now, updatedAt: now } });
      }
    }
  }

  const expiring = await c.socialAccounts
    .find({
      provider: { $ne: "simulation" },
      status: "connected",
      tokenExpiresAt: { $gt: now, $lte: new Date(now.getTime() + EXPIRY_WARNING_DAYS * DAY) },
      $or: [{ expiryWarnedAt: { $exists: false } }, { expiryWarnedAt: null }],
    })
    .limit(50)
    .toArray();
  for (const account of expiring) {
    const result = await c.socialAccounts.updateOne(
      { _id: account._id, $or: [{ expiryWarnedAt: { $exists: false } }, { expiryWarnedAt: null }] },
      { $set: { expiryWarnedAt: now } },
    );
    if (result.modifiedCount === 1) {
      await deps.notifier.accountExpiring(account);
      summary.warned += 1;
    }
  }

  const expired = await c.socialAccounts
    .find({ provider: { $ne: "simulation" }, status: "connected", tokenExpiresAt: { $lte: now } })
    .limit(50)
    .toArray();
  for (const account of expired) {
    const result = await c.socialAccounts.updateOne(
      { _id: account._id, status: "connected" },
      { $set: { status: "expired", lastError: "Autorisation expirée.", updatedAt: now } },
    );
    if (result.modifiedCount === 1) {
      await deps.notifier.accountExpired(account);
      summary.expired += 1;
    }
  }
  return summary;
}

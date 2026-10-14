import "server-only";
import { MongoClient, type Db } from "mongodb";
import { runMigrations } from "@/server/db/migrations";
import { getServerEnv } from "@/server/env";

/**
 * Client MongoDB réutilisé entre les invocations serverless.
 * Le client est conservé sur globalThis pour survivre au rechargement à chaud
 * en développement et aux invocations successives d'une même instance Vercel.
 */
const globalForMongo = globalThis as typeof globalThis & {
  __smiaMongoClient?: MongoClient;
  __smiaDbReady?: Promise<void>;
};

export function getMongoClient(): MongoClient {
  if (!globalForMongo.__smiaMongoClient) {
    const { MONGODB_URI } = getServerEnv();
    globalForMongo.__smiaMongoClient = new MongoClient(MONGODB_URI, {
      appName: "studio-marketing-ia",
      maxPoolSize: 10,
    });
  }
  return globalForMongo.__smiaMongoClient;
}

export function getDb(): Db {
  return getMongoClient().db(getServerEnv().MONGODB_DB_NAME);
}

/**
 * Garantit une connexion active, puis applique les migrations en attente (une fois par instance).
 *
 * À appeler en début de requête. Après un échec de connexion (réseau, IP refusée…), le pilote
 * conserve une connexion fermée et toutes les requêtes suivantes échouent avec
 * « Topology is closed ». Appeler `connect()` recrée alors la connexion ; c'est immédiat
 * quand elle est déjà ouverte.
 * Les migrations permettent de déployer sur Vercel sans lancer `pnpm db:migrate` à la main.
 */
export async function ensureDatabaseReady(): Promise<void> {
  await getMongoClient().connect();
  globalForMongo.__smiaDbReady ??= runMigrations(getDb(), () => {})
    .then(() => undefined)
    .catch((error: unknown) => {
      // Nouvelle tentative à la requête suivante.
      globalForMongo.__smiaDbReady = undefined;
      throw error;
    });
  return globalForMongo.__smiaDbReady;
}

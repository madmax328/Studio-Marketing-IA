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
 * Applique les migrations en attente une fois par instance, au premier accès.
 * Permet de déployer sur Vercel sans lancer `pnpm db:migrate` à la main.
 * En cas d'échec, la tentative sera refaite à la requête suivante.
 */
export function ensureDatabaseReady(): Promise<void> {
  globalForMongo.__smiaDbReady ??= runMigrations(getDb(), () => {})
    .then(() => undefined)
    .catch((error: unknown) => {
      globalForMongo.__smiaDbReady = undefined;
      throw error;
    });
  return globalForMongo.__smiaDbReady;
}

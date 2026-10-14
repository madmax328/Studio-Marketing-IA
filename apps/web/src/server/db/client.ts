import "server-only";
import { MongoClient, type Db } from "mongodb";
import { getServerEnv } from "@/server/env";

/**
 * Client MongoDB réutilisé entre les invocations serverless.
 * Le client est conservé sur globalThis pour survivre au rechargement à chaud
 * en développement et aux invocations successives d'une même instance Vercel.
 */
const globalForMongo = globalThis as typeof globalThis & {
  __smiaMongoClient?: MongoClient;
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

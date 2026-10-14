/**
 * Applique les migrations MongoDB en attente.
 * Usage : pnpm db:migrate (lit apps/web/.env.local si présent).
 */
import { MongoClient } from "mongodb";
import { runMigrations } from "../src/server/db/migrations/index";

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME ?? "studio_marketing_ia";
  if (!uri) {
    console.error("MONGODB_URI est manquant. Renseignez-le dans apps/web/.env.local.");
    process.exit(1);
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    await runMigrations(client.db(dbName));
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error("Échec de la migration :", error instanceof Error ? error.message : error);
  process.exit(1);
});

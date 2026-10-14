import type { Db } from "mongodb";
import { collections } from "../collections";
import { migration001 } from "./001-initial-indexes";

export interface Migration {
  /** Identifiant unique et ordonné, ex. "001-initial-indexes". Ne jamais renommer. */
  id: string;
  up(db: Db): Promise<void>;
}

/** Liste ordonnée des migrations. Ajouter les nouvelles à la fin, ne jamais modifier une migration appliquée. */
export const MIGRATIONS: readonly Migration[] = [migration001];

export async function runMigrations(db: Db, log: (message: string) => void = console.log): Promise<string[]> {
  const { migrations } = collections(db);
  const applied = new Set((await migrations.find({}, { projection: { _id: 1 } }).toArray()).map((m) => m._id));
  const newlyApplied: string[] = [];

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    log(`→ Migration ${migration.id}…`);
    await migration.up(db);
    await migrations.insertOne({ _id: migration.id, appliedAt: new Date() });
    newlyApplied.push(migration.id);
  }

  log(newlyApplied.length === 0 ? "Base de données à jour." : `${newlyApplied.length} migration(s) appliquée(s).`);
  return newlyApplied;
}

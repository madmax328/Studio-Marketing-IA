import type { Db } from "mongodb";
import { collections } from "../collections";
import { migration001 } from "./001-initial-indexes";
import { migration002 } from "./002-generation-jobs";
import { migration003 } from "./003-media-assets";
import { migration004 } from "./004-campaigns-calendar";
import { migration005 } from "./005-publishing";
import { migration006 } from "./006-billing";
import { migration007 } from "./007-plan-features";
import { migration008 } from "./008-plan-audience";
import { migration009 } from "./009-analytics";
import { migration010 } from "./010-testimonials";
import { migration011 } from "./011-voiceover";
import { migration012 } from "./012-teams";

export interface Migration {
  /** Identifiant unique et ordonné, ex. "001-initial-indexes". Ne jamais renommer. */
  id: string;
  up(db: Db): Promise<void>;
}

/**
 * Liste ordonnée des migrations. Ajouter les nouvelles à la fin, ne jamais modifier une migration appliquée.
 * Chaque migration doit être idempotente : elle peut être lancée par plusieurs instances en même temps.
 */
export const MIGRATIONS: readonly Migration[] = [migration001, migration002, migration003, migration004, migration005, migration006, migration007, migration008, migration009, migration010, migration011, migration012];

export async function runMigrations(db: Db, log: (message: string) => void = console.log): Promise<string[]> {
  const { migrations } = collections(db);
  const applied = new Set((await migrations.find({}, { projection: { _id: 1 } }).toArray()).map((m) => m._id));
  const newlyApplied: string[] = [];

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    log(`→ Migration ${migration.id}…`);
    await migration.up(db);
    try {
      await migrations.insertOne({ _id: migration.id, appliedAt: new Date() });
    } catch (error) {
      // Une autre instance a appliqué la même migration en parallèle : les migrations sont idempotentes.
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error;
      continue;
    }
    newlyApplied.push(migration.id);
  }

  log(newlyApplied.length === 0 ? "Base de données à jour." : `${newlyApplied.length} migration(s) appliquée(s).`);
  return newlyApplied;
}

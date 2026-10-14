/**
 * Vérifie le comportement du pilote MongoDB sur lequel repose ensureDatabaseReady :
 * après un échec de connexion, un nouvel appel à connect() repart d'une connexion neuve
 * au lieu de rester bloqué sur « Topology is closed ».
 */
import { MongoClient, MongoTopologyClosedError } from "mongodb";
import { describe, expect, it } from "vitest";

describe("reconnexion MongoDB après un échec", () => {
  it("une opération reste bloquée, mais connect() crée une nouvelle connexion", async () => {
    // Port fermé : la connexion échoue rapidement.
    const client = new MongoClient("mongodb://127.0.0.1:1/?directConnection=true", { serverSelectionTimeoutMS: 300 });

    await expect(client.db("x").collection("y").findOne({})).rejects.toThrow();
    // Sans reconnexion explicite : connexion fermée réutilisée.
    await expect(client.db("x").collection("y").findOne({})).rejects.toBeInstanceOf(MongoTopologyClosedError);

    // Avec connect() : nouvelle tentative réelle (qui échoue ici pour une raison réseau, pas « fermée »).
    const error = await client.connect().catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(MongoTopologyClosedError);
    await client.close();
  });
});

/**
 * Tests d'intégration sur une vraie base MongoDB.
 * Ils s'exécutent uniquement si TEST_MONGODB_URI est défini (c'est le cas en CI).
 * Chaque exécution utilise une base dédiée, supprimée à la fin.
 */
import { MongoClient, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { collections } from "@/server/db/collections";
import { runMigrations } from "@/server/db/migrations";
import { deleteUserData, exportUserData } from "@/server/services/account";
import { createBrand, getBrand, listBrands, updateBrand } from "@/server/services/brands";
import { UserFacingError } from "@/server/services/errors";
import { ensurePersonalWorkspace, getWorkspaceAccess, type WorkspaceAccess } from "@/server/services/workspaces";

const uri = process.env.TEST_MONGODB_URI;

describe.skipIf(!uri)("isolation des données (MongoDB réel)", () => {
  let client: MongoClient;
  let db: Db;
  let alice: WorkspaceAccess;
  let bob: WorkspaceAccess;

  beforeAll(async () => {
    client = new MongoClient(uri as string);
    await client.connect();
    db = client.db(`smia_test_${Date.now()}`);
    await runMigrations(db, () => {});

    const aliceWs = await ensurePersonalWorkspace(db, { id: "alice", name: "Alice" });
    const bobWs = await ensurePersonalWorkspace(db, { id: "bob", name: "Bob" });
    alice = (await getWorkspaceAccess(db, "alice", aliceWs._id.toHexString()))!;
    bob = (await getWorkspaceAccess(db, "bob", bobWs._id.toHexString()))!;
  });

  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  it("les migrations sont idempotentes", async () => {
    expect(await runMigrations(db, () => {})).toEqual([]);
  });

  it("crée un seul espace personnel, même en appels concurrents", async () => {
    await Promise.all([
      ensurePersonalWorkspace(db, { id: "carol", name: "Carol" }),
      ensurePersonalWorkspace(db, { id: "carol", name: "Carol" }),
      ensurePersonalWorkspace(db, { id: "carol", name: "Carol" }),
    ]);
    expect(await collections(db).workspaces.countDocuments({ ownerUserId: "carol", personal: true })).toBe(1);
  });

  it("le propriétaire a le rôle owner", () => {
    expect(alice.role).toBe("owner");
  });

  it("refuse l'accès à l'espace d'un autre utilisateur", async () => {
    expect(await getWorkspaceAccess(db, "bob", alice.workspace._id.toHexString())).toBeNull();
    expect(await getWorkspaceAccess(db, "bob", "identifiant-invalide")).toBeNull();
  });

  it("une marque n'est visible que dans son espace", async () => {
    const brand = await createBrand(db, alice, "alice", { name: "Boulangerie d'Alice" });

    expect(await listBrands(db, alice)).toHaveLength(1);
    expect(await listBrands(db, bob)).toHaveLength(0);
    await expect(getBrand(db, bob, brand._id.toHexString())).rejects.toBeInstanceOf(UserFacingError);
    await expect(
      updateBrand(db, bob, "bob", brand._id.toHexString(), { name: "Piratée" }),
    ).rejects.toBeInstanceOf(UserFacingError);
    expect((await getBrand(db, alice, brand._id.toHexString())).name).toBe("Boulangerie d'Alice");
  });

  it("respecte la limite de marques de l'offre", async () => {
    await expect(createBrand(db, alice, "alice", { name: "Deuxième" })).rejects.toMatchObject({ code: "limit_reached" });
  });

  it("un lecteur ne peut pas créer de marque", async () => {
    await expect(createBrand(db, { ...bob, role: "viewer" }, "bob", { name: "X" })).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("l'export ne contient que les données de l'utilisateur", async () => {
    const data = await exportUserData({ id: "bob", name: "Bob", email: "bob@example.com", createdAt: new Date() }, db);
    expect(data.brands).toHaveLength(0);
    expect(data.workspaces).toHaveLength(1);
  });

  it("la suppression du compte efface ses données et pas celles des autres", async () => {
    await createBrand(db, bob, "bob", { name: "Garage de Bob" });
    await deleteUserData("alice", db);

    const c = collections(db);
    expect(await c.workspaces.countDocuments({ ownerUserId: "alice" })).toBe(0);
    expect(await c.brands.countDocuments({ workspaceId: alice.workspace._id })).toBe(0);
    expect(await c.workspaceMembers.countDocuments({ userId: "alice" })).toBe(0);
    expect(await c.auditLogs.countDocuments({ actorUserId: "alice" })).toBe(0);
    expect(await c.brands.countDocuments({ workspaceId: bob.workspace._id })).toBe(1);
  });
});

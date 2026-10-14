/**
 * Tests d'intégration du studio sur une vraie base MongoDB (TEST_MONGODB_URI, fourni en CI).
 * Le fournisseur d'IA est simulé : on vérifie nos règles (accord, quota, anti-doublon, isolation).
 */
import { randomUUID } from "node:crypto";
import { MongoClient, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { TextGenerationError, type TextGenerationProvider } from "@/server/ai/types";
import { collections } from "@/server/db/collections";
import { runMigrations } from "@/server/db/migrations";
import { createBrand } from "@/server/services/brands";
import { acceptAiConsent, generateTextPosts } from "@/server/services/generation";
import { createDraft, deletePost, getPost, listPosts, updatePostText } from "@/server/services/posts";
import { ensurePersonalWorkspace, getWorkspaceAccess, type WorkspaceAccess } from "@/server/services/workspaces";

const uri = process.env.TEST_MONGODB_URI;

function fakeProvider(overrides: Partial<TextGenerationProvider> = {}) {
  const generatePosts = vi.fn<TextGenerationProvider["generatePosts"]>(async (input) => ({
    model: "fake-model",
    usage: { inputTokens: 10, outputTokens: 10 },
    output: {
      posts: [
        ...input.networks.map((network) => ({ network, text: `Texte ${network}`, hashtags: ["test"], rationale: "Rôle." })),
        // Réseau non demandé : doit être ignoré.
        { network: "pinterest" as const, text: "Hors sujet", hashtags: [], rationale: "" },
      ],
      missingInformation: ["Prix"],
    },
  }));
  const provider: TextGenerationProvider = {
    id: "fake",
    label: "Fake",
    dataProcessor: "Test",
    isConfigured: () => true,
    generatePosts,
    ...overrides,
  };
  return { provider, generatePosts };
}

describe.skipIf(!uri)("studio de contenu (MongoDB réel)", () => {
  let client: MongoClient;
  let db: Db;
  let alice: WorkspaceAccess;
  let bob: WorkspaceAccess;
  let aliceBrandId: string;

  async function refresh(userId: string, access: WorkspaceAccess) {
    return (await getWorkspaceAccess(db, userId, access.workspace._id.toHexString()))!;
  }

  beforeAll(async () => {
    client = new MongoClient(uri as string);
    await client.connect();
    db = client.db(`smia_test_gen_${Date.now()}`);
    await runMigrations(db, () => {});
    const a = await ensurePersonalWorkspace(db, { id: "alice", name: "Alice" });
    const b = await ensurePersonalWorkspace(db, { id: "bob", name: "Bob" });
    alice = (await getWorkspaceAccess(db, "alice", a._id.toHexString()))!;
    bob = (await getWorkspaceAccess(db, "bob", b._id.toHexString()))!;
    aliceBrandId = (await createBrand(db, alice, "alice", { name: "Boulangerie" }))._id.toHexString();
  });

  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  const request = (overrides: Record<string, unknown> = {}) => ({
    brandId: aliceBrandId,
    networks: ["instagram", "linkedin"],
    brief: "Nouveau pain aux noix",
    requestId: randomUUID(),
    ...overrides,
  });

  it("exige l'accord avant tout envoi au fournisseur", async () => {
    const { provider, generatePosts } = fakeProvider();
    await expect(generateTextPosts(db, alice, "alice", request(), provider)).rejects.toMatchObject({
      code: "consent_required",
    });
    expect(generatePosts).not.toHaveBeenCalled();
  });

  it("génère, filtre les réseaux non demandés et ne génère qu'une fois par requestId", async () => {
    const { provider, generatePosts } = fakeProvider();
    await acceptAiConsent(db, alice, "alice", provider);
    alice = await refresh("alice", alice);

    const input = request();
    const first = await generateTextPosts(db, alice, "alice", input, provider);
    const second = await generateTextPosts(db, alice, "alice", input, provider);

    expect(first.posts.map((p) => p.network)).toEqual(["instagram", "linkedin"]);
    expect(first.posts[0]?.composedText).toBe("Texte instagram\n\n#test");
    expect(first.missingInformation).toEqual(["Prix"]);
    expect(second.jobId).toBe(first.jobId);
    expect(generatePosts).toHaveBeenCalledTimes(1);
  });

  it("refuse la marque d'un autre espace", async () => {
    const { provider } = fakeProvider({ id: "fake" });
    await acceptAiConsent(db, bob, "bob", provider);
    bob = await refresh("bob", bob);
    await expect(generateTextPosts(db, bob, "bob", request(), provider)).rejects.toMatchObject({ code: "not_found" });
  });

  it("ne compte pas les échecs et applique le quota mensuel", async () => {
    const failing = fakeProvider({
      generatePosts: async () => {
        throw new TextGenerationError("Service indisponible", true);
      },
    }).provider;
    await expect(generateTextPosts(db, alice, "alice", request(), failing)).rejects.toThrow("Service indisponible");

    await collections(db).workspaces.updateOne(
      { _id: alice.workspace._id },
      { $set: { "limits.monthlyTextGenerations": 2 } },
    );
    alice = await refresh("alice", alice);
    const { provider } = fakeProvider();
    await generateTextPosts(db, alice, "alice", request(), provider); // 2e génération réussie
    await expect(generateTextPosts(db, alice, "alice", request(), provider)).rejects.toMatchObject({
      code: "limit_reached",
    });
  });

  it("enregistre, modifie et supprime un brouillon dans son seul espace", async () => {
    const post = await createDraft(db, alice, "alice", {
      brandId: aliceBrandId,
      network: "x",
      text: "Pain aux noix ce samedi",
    });
    const id = post._id.toHexString();

    await expect(getPost(db, bob, id)).rejects.toMatchObject({ code: "not_found" });
    await expect(updatePostText(db, bob, id, "Piraté")).rejects.toMatchObject({ code: "not_found" });
    await expect(updatePostText(db, alice, id, "a".repeat(281))).rejects.toMatchObject({ code: "invalid_input" });

    expect((await updatePostText(db, alice, id, "Pain aux noix samedi matin")).text).toBe("Pain aux noix samedi matin");
    expect((await listPosts(db, alice, { status: "draft" })).total).toBe(1);
    expect((await listPosts(db, bob)).total).toBe(0);

    await deletePost(db, alice, "alice", id);
    await expect(getPost(db, alice, id)).rejects.toMatchObject({ code: "not_found" });
  });
});

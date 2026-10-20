/**
 * IA locale (application de bureau) sur une vraie base MongoDB (TEST_MONGODB_URI, fourni en CI).
 */
import { randomUUID } from "node:crypto";
import { MongoClient, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { collections } from "@/server/db/collections";
import { runMigrations } from "@/server/db/migrations";
import { getCreditAccount } from "@/server/services/billing";
import { createBrand } from "@/server/services/brands";
import { completeLocalGeneration, prepareLocalGeneration } from "@/server/services/local-generation";
import { ensurePersonalWorkspace, getWorkspaceAccess, type WorkspaceAccess } from "@/server/services/workspaces";

const uri = process.env.TEST_MONGODB_URI;

describe.skipIf(!uri)("IA locale (MongoDB réel)", () => {
  let client: MongoClient;
  let db: Db;
  let access: WorkspaceAccess;
  let brandId: string;
  const request = () => ({ requestId: randomUUID(), brandId, networks: ["facebook", "instagram"], kind: "libre", brief: "Portes ouvertes samedi", variantsPerNetwork: 1 });
  const output = JSON.stringify({
    posts: [
      { network: "facebook", text: "Portes ouvertes samedi !", hashtags: ["yoga"], rationale: "Annonce" },
      { network: "x", text: "Hors demande", hashtags: [], rationale: "" },
    ],
    missingInformation: ["Horaires"],
  });

  beforeAll(async () => {
    client = new MongoClient(uri as string);
    await client.connect();
    db = client.db(`smia_test_local_${Date.now()}`);
    await runMigrations(db, () => {});
    const workspace = await ensurePersonalWorkspace(db, { id: "alice", name: "Alice" });
    access = (await getWorkspaceAccess(db, "alice", workspace._id.toHexString()))!;
    brandId = (await createBrand(db, access, "alice", { name: "Studio Ananda", industry: "Yoga" }))._id.toHexString();
  });

  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  it("prépare les consignes (marque comprise) sans accord fournisseur ni crédit, puis valide la réponse comme celle du cloud", async () => {
    const prepared = await prepareLocalGeneration(db, access, "alice", request());
    expect(prepared.user).toContain("Studio Ananda");
    expect(prepared.schema).toMatchObject({ type: "object", required: ["posts", "missingInformation"] });

    const view = await completeLocalGeneration(db, access, "alice", { jobId: prepared.jobId, output, model: "qwen2.5:7b" });
    // Le réseau non demandé est écarté.
    expect(view.posts.map((post) => post.network)).toEqual(["facebook"]);
    expect(view.posts[0]?.composedText).toBe("Portes ouvertes samedi !\n\n#yoga");
    expect(view.missingInformation).toEqual(["Horaires"]);
    expect(await collections(db).generationJobs.findOne({ provider: "local" })).toMatchObject({ status: "succeeded", model: "local:qwen2.5:7b" });
    expect((await getCreditAccount(db, access.workspace)).used).toBe(0);

    // Une demande ne sert qu'une fois.
    await expect(completeLocalGeneration(db, access, "alice", { jobId: prepared.jobId, output, model: "m" })).rejects.toMatchObject({ code: "not_found" });
  });

  it("refuse une réponse illisible ou hors format, une demande d'une autre personne ou trop ancienne", async () => {
    const a = await prepareLocalGeneration(db, access, "alice", request());
    await expect(completeLocalGeneration(db, access, "alice", { jobId: a.jobId, output: "pas du JSON", model: "m" })).rejects.toThrow(/illisible/);
    const b = await prepareLocalGeneration(db, access, "alice", request());
    await expect(completeLocalGeneration(db, access, "alice", { jobId: b.jobId, output: JSON.stringify({ posts: "x" }), model: "m" })).rejects.toThrow(/format/);
    const c = await prepareLocalGeneration(db, access, "alice", request());
    await expect(completeLocalGeneration(db, access, "bob", { jobId: c.jobId, output, model: "m" })).rejects.toMatchObject({ code: "not_found" });
    const late = new Date(Date.now() + 16 * 60_000);
    await expect(completeLocalGeneration(db, access, "alice", { jobId: c.jobId, output, model: "m" }, late)).rejects.toMatchObject({ code: "not_found" });
  });
});

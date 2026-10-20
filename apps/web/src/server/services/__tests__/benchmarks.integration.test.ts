/**
 * Repères anonymes sur une vraie base MongoDB (TEST_MONGODB_URI, fourni en CI).
 */
import { MongoClient, ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { collections, type PostDoc } from "@/server/db/collections";
import { runMigrations } from "@/server/db/migrations";
import { getBenchmarkTips, refreshBenchmarks, setBenchmarkSharing } from "@/server/services/benchmarks";
import { ensurePersonalWorkspace, getWorkspaceAccess } from "@/server/services/workspaces";

const uri = process.env.TEST_MONGODB_URI;

describe.skipIf(!uri)("repères anonymes (MongoDB réel)", () => {
  let client: MongoClient;
  let db: Db;
  const now = new Date("2031-03-01T12:00:00Z");

  /** 8 comptes ; chacun 4 publications du soir (20 interactions) et 4 du matin (10), sur Instagram. */
  async function seed() {
    const posts: PostDoc[] = [];
    for (let a = 0; a < 8; a += 1) {
      const workspace = await ensurePersonalWorkspace(db, { id: `u${a}`, name: `U${a}` });
      for (let i = 0; i < 8; i += 1) {
        const evening = i % 2 === 0;
        posts.push({
          _id: new ObjectId(),
          workspaceId: workspace._id,
          brandId: new ObjectId(),
          network: "instagram",
          status: "published",
          text: "secret",
          rationale: "",
          generationJobId: null,
          mediaKind: "image",
          scheduledAt: null,
          timeZone: "Europe/Paris",
          publishedAt: new Date(Date.UTC(2031, 1, 2 + i, evening ? 18 : 7)),
          metrics: { values: { likes: evening ? 20 : 10 }, collectedAt: now, nextCollectAt: null, unsupported: false, lastError: null },
          schemaVersion: 1,
          createdAt: now,
          updatedAt: now,
        } as PostDoc);
      }
    }
    // Une simulation ne compte jamais.
    posts.push({ ...(posts[0] as PostDoc), _id: new ObjectId(), publishing: { simulated: true } as PostDoc["publishing"] });
    await collections(db).posts.insertMany(posts);
  }

  beforeAll(async () => {
    client = new MongoClient(uri as string);
    await client.connect();
    db = client.db(`smia_test_bench_${Date.now()}`);
    await runMigrations(db, () => {});
    await seed();
  });

  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  it("ne garde que des agrégats, recalculés au plus une fois par jour", async () => {
    expect(await refreshBenchmarks(db, now)).toBe(true);
    expect(await refreshBenchmarks(db, new Date(now.getTime() + 3600_000))).toBe(false);
    const doc = await collections(db).benchmarks.findOne({ _id: "global" });
    expect(doc?.participants).toBe(8);
    const serialized = JSON.stringify(doc);
    expect(serialized).not.toContain("secret");
    const workspace = await collections(db).workspaces.findOne({});
    expect(serialized).not.toContain(workspace?._id.toHexString() ?? "x");
    expect(doc?.groups.find((group) => group.value === "soir")).toMatchObject({ workspaces: 8, posts: 32 });
  });

  it("conseils réservés aux participants ; un espace qui se retire n'est plus compté", async () => {
    const workspace = await ensurePersonalWorkspace(db, { id: "u0", name: "U0" });
    let access = (await getWorkspaceAccess(db, "u0", workspace._id.toHexString()))!;
    expect((await getBenchmarkTips(db, access)).tips.map((tip) => tip.id)).toEqual(["instagram-slot"]);

    await setBenchmarkSharing(db, access, "u0", false);
    access = (await getWorkspaceAccess(db, "u0", workspace._id.toHexString()))!;
    expect(await getBenchmarkTips(db, access)).toMatchObject({ participating: false, tips: [] });
    await refreshBenchmarks(db, now, true);
    expect((await collections(db).benchmarks.findOne({ _id: "global" }))?.participants).toBe(7);
  });
});

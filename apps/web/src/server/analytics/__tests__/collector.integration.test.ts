/**
 * Relevé des statistiques et vue d'ensemble sur une vraie base MongoDB (TEST_MONGODB_URI, fourni en CI).
 * Les réseaux sont simulés par de faux connecteurs : aucun appel extérieur.
 */
import { randomBytes } from "node:crypto";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { collections, type PostDoc, type SocialAccountDoc } from "@/server/db/collections";
import { runMigrations } from "@/server/db/migrations";
import { encryptSecret } from "@/server/security/crypto";
import { bestPerformingPosts, getAnalyticsOverview } from "@/server/services/analytics";
import { ensurePersonalWorkspace, getWorkspaceAccess, type WorkspaceAccess } from "@/server/services/workspaces";
import { collectDueMetrics } from "../collector";
import { MetricsError, type MetricsFetcher } from "../types";

const uri = process.env.TEST_MONGODB_URI;
const key = randomBytes(32).toString("base64");
const HOUR = 3600_000;

describe.skipIf(!uri)("statistiques (MongoDB réel)", () => {
  let client: MongoClient;
  let db: Db;
  let access: WorkspaceAccess;
  const brandId = new ObjectId();
  const now = new Date("2030-03-10T12:00:00Z");

  async function addAccount(provider: SocialAccountDoc["provider"], network: SocialAccountDoc["network"]) {
    const _id = new ObjectId();
    await collections(db).socialAccounts.insertOne({
      _id,
      workspaceId: access.workspace._id,
      network,
      provider,
      externalAccountId: `${provider}-${network}-${_id.toHexString()}`,
      displayName: "Compte",
      status: "connected",
      scopes: [],
      accessToken: provider === "simulation" ? null : encryptSecret("jeton-secret", key),
      refreshToken: null,
      tokenExpiresAt: null,
      lastCheckedAt: null,
      lastError: null,
      connectedByUserId: "alice",
      createdAt: now,
      updatedAt: now,
    });
    return _id;
  }

  async function addPublished(accountId: ObjectId, overrides: Partial<PostDoc> = {}) {
    const _id = new ObjectId();
    await collections(db).posts.insertOne({
      _id,
      workspaceId: access.workspace._id,
      brandId,
      network: "facebook",
      status: "published",
      text: `Publication ${_id.toHexString()}`,
      rationale: "",
      generationJobId: null,
      scheduledAt: new Date(now.getTime() - 5 * HOUR),
      timeZone: "Europe/Paris",
      publishedAt: new Date(now.getTime() - 5 * HOUR),
      publishing: {
        attempts: 1,
        nextAttemptAt: null,
        lockedAt: null,
        lockId: null,
        socialAccountId: accountId,
        externalId: `ext-${_id.toHexString()}`,
        externalUrl: null,
        simulated: false,
        lastError: null,
        lastAttemptAt: null,
      },
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    });
    return _id;
  }

  beforeAll(async () => {
    client = new MongoClient(uri as string);
    await client.connect();
    db = client.db(`smia_test_stats_${Date.now()}`);
    await runMigrations(db, () => {});
    const workspace = await ensurePersonalWorkspace(db, { id: "alice", name: "Alice" });
    access = (await getWorkspaceAccess(db, "alice", workspace._id.toHexString()))!;
  });

  beforeEach(async () => {
    await collections(db).posts.deleteMany({});
    await collections(db).socialAccounts.deleteMany({});
    await collections(db).analyticsSnapshots.deleteMany({});
  });

  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  it("relève les publications réelles dues, historise, planifie la suite ; ignore simulations, trop récentes et trop anciennes", async () => {
    const meta = await addAccount("meta", "facebook");
    const simulation = await addAccount("simulation", "facebook");
    const due = await addPublished(meta);
    const simulated = await addPublished(simulation, { publishing: { ...((await collections(db).posts.findOne({ _id: due }))?.publishing as NonNullable<PostDoc["publishing"]>), socialAccountId: simulation, simulated: true } });
    const tooRecent = await addPublished(meta, { publishedAt: new Date(now.getTime() - 10 * 60_000) });
    const tooOld = await addPublished(meta, { publishedAt: new Date(now.getTime() - 40 * 24 * HOUR) });

    const fetch = vi.fn<MetricsFetcher["fetch"]>(async ({ accessToken }) => {
      expect(accessToken).toBe("jeton-secret");
      return { likes: 12, comments: 3, reach: 200 };
    });
    const summary = await collectDueMetrics({ db, fetchers: { meta: { provider: "meta", fetch } }, encryptionKey: key, now: () => now });

    expect(summary).toEqual({ collected: 1, unsupported: 0, failed: 0 });
    expect(fetch).toHaveBeenCalledTimes(1);
    const post = await collections(db).posts.findOne({ _id: due });
    expect(post?.metrics?.values).toEqual({ likes: 12, comments: 3, reach: 200 });
    expect(post?.metrics?.nextCollectAt?.toISOString()).toBe(new Date(now.getTime() + 3 * HOUR).toISOString());
    expect(await collections(db).analyticsSnapshots.countDocuments({ postId: due })).toBe(1);
    for (const id of [simulated, tooRecent, tooOld]) expect((await collections(db).posts.findOne({ _id: id }))?.metrics).toBeUndefined();

    // Déjà relevée : rien à faire avant le prochain créneau.
    expect((await collectDueMetrics({ db, fetchers: { meta: { provider: "meta", fetch } }, encryptionKey: key, now: () => now })).collected).toBe(0);
  });

  it("réseau sans statistiques (LinkedIn) : signalé non mesuré, sans nouvel essai", async () => {
    const linkedin = await addAccount("linkedin", "linkedin");
    const id = await addPublished(linkedin, { network: "linkedin" });
    const summary = await collectDueMetrics({ db, fetchers: {}, encryptionKey: key, now: () => now });
    expect(summary.unsupported).toBe(1);
    const post = await collections(db).posts.findOne({ _id: id });
    expect(post?.metrics).toMatchObject({ unsupported: true, nextCollectAt: null, collectedAt: null });
    expect(post?.metrics?.lastError).toContain("LinkedIn");
  });

  it("erreur passagère : nouvel essai plus tard ; publication supprimée : suivi arrêté", async () => {
    const meta = await addAccount("meta", "facebook");
    const flaky = await addPublished(meta);
    const deleted = await addPublished(meta, { publishedAt: new Date(now.getTime() - 6 * HOUR) });
    const fetch = vi.fn<MetricsFetcher["fetch"]>(async ({ post }) => {
      throw post._id.equals(flaky) ? new MetricsError("Panne", "retryable") : new MetricsError("Supprimée", "gone");
    });
    await collectDueMetrics({ db, fetchers: { meta: { provider: "meta", fetch } }, encryptionKey: key, now: () => now });
    expect((await collections(db).posts.findOne({ _id: flaky }))?.metrics?.nextCollectAt).not.toBeNull();
    expect((await collections(db).posts.findOne({ _id: deleted }))?.metrics).toMatchObject({ nextCollectAt: null, unsupported: false });
  });

  it("vue d'ensemble : totaux réels, simulations à part, meilleures publications, conseils et exemples pour l'IA", async () => {
    const meta = await addAccount("meta", "facebook");
    const insta = await addAccount("meta", "instagram");
    const measured = (likes: number, network: PostDoc["network"], account: ObjectId, hoursAgo: number) =>
      addPublished(account, {
        network,
        publishedAt: new Date(now.getTime() - hoursAgo * HOUR),
        metrics: { values: { likes, comments: 1 }, collectedAt: now, nextCollectAt: null, unsupported: false, lastError: null, attempts: 1 },
      });
    for (let i = 0; i < 3; i += 1) await measured(40, "instagram", insta, 24 * (i + 1));
    for (let i = 0; i < 3; i += 1) await measured(5, "facebook", meta, 24 * (i + 1) + 2);
    await addPublished(meta, { publishing: { attempts: 1, nextAttemptAt: null, lockedAt: null, lockId: null, socialAccountId: meta, externalId: "s", externalUrl: null, simulated: true, lastError: null, lastAttemptAt: null } });

    const overview = await getAnalyticsOverview(db, access, { days: 30, now });
    expect(overview.published).toBe(6);
    expect(overview.simulated).toBe(1);
    expect(overview.measured).toBe(6);
    expect(overview.totals.likes).toEqual({ sum: 135, posts: 6 });
    expect(overview.totals.reach).toBeUndefined();
    expect(overview.topPosts[0]?.network).toBe("instagram");
    expect(overview.recommendations.find((item) => item.id === "network")?.title).toContain("Instagram");

    const examples = await bestPerformingPosts(db, access.workspace._id, brandId, { now });
    expect(examples).toHaveLength(3);
    expect(examples.every((item) => item.network === "instagram" && item.engagement === 41)).toBe(true);
    // Une autre marque n'hérite pas de ces exemples.
    expect(await bestPerformingPosts(db, access.workspace._id, new ObjectId(), { now })).toEqual([]);
  });
});

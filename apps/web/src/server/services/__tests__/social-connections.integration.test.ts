/**
 * Connexion des comptes sociaux sur une vraie base MongoDB (TEST_MONGODB_URI, fourni en CI).
 * Les réseaux sont simulés : aucun appel extérieur.
 */
import { randomBytes } from "node:crypto";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { collections, type SocialAccountDoc } from "@/server/db/collections";
import { runMigrations } from "@/server/db/migrations";
import { maintainSocialTokens } from "@/server/publishing/tokens";
import { decryptSecret, encryptSecret } from "@/server/security/crypto";
import type { OAuthCandidate } from "@/server/social/oauth";
import { connectSimulationAccount } from "@/server/services/social-accounts";
import {
  confirmOAuthConnection,
  getPendingConnection,
  receiveOAuthCallback,
  startOAuthConnection,
} from "@/server/services/social-connections";
import { setPostAccount } from "@/server/services/posts";
import { ensurePersonalWorkspace, getWorkspaceAccess, type WorkspaceAccess } from "@/server/services/workspaces";

const uri = process.env.TEST_MONGODB_URI;
const key = randomBytes(32).toString("base64");

const page = (id: string, network: OAuthCandidate["network"] = "facebook"): OAuthCandidate => ({
  network,
  externalAccountId: id,
  displayName: `Compte ${id}`,
  scopes: ["pages_manage_posts"],
  accessToken: `jeton-${id}`,
  tokenExpiresAt: null,
});

describe.skipIf(!uri)("connexion des comptes sociaux (MongoDB réel)", () => {
  let client: MongoClient;
  let db: Db;
  let alice: WorkspaceAccess;
  let bob: WorkspaceAccess;

  async function connect(access: WorkspaceAccess, userId: string, candidates: OAuthCandidate[], keys?: string[]) {
    const stateId = await startOAuthConnection(db, access, userId, "meta");
    await receiveOAuthCallback(db, { stateId, userId, provider: "meta", encryptionKey: key, exchange: async () => candidates });
    return {
      stateId,
      confirm: () => confirmOAuthConnection(db, access, userId, stateId, keys ?? candidates.map((c) => `${c.network}:${c.externalAccountId}`)),
    };
  }

  beforeAll(async () => {
    client = new MongoClient(uri as string);
    await client.connect();
    db = client.db(`smia_test_social_${Date.now()}`);
    await runMigrations(db, () => {});
    const aliceWs = await ensurePersonalWorkspace(db, { id: "alice", name: "Alice" });
    const bobWs = await ensurePersonalWorkspace(db, { id: "bob", name: "Bob" });
    alice = (await getWorkspaceAccess(db, "alice", aliceWs._id.toHexString()))!;
    bob = (await getWorkspaceAccess(db, "bob", bobWs._id.toHexString()))!;
  });

  beforeEach(async () => {
    await collections(db).socialAccounts.deleteMany({});
    await collections(db).oauthStates.deleteMany({});
  });

  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  it("enregistre les comptes choisis avec des jetons chiffrés, jamais en clair", async () => {
    const flow = await connect(alice, "alice", [page("P1"), page("IG1", "instagram")], ["facebook:P1"]);
    const view = await getPendingConnection(db, alice, "alice", flow.stateId);
    expect(view.candidates.map((c) => c.key)).toEqual(["facebook:P1", "instagram:IG1"]);
    expect(JSON.stringify(await collections(db).oauthStates.findOne({ _id: flow.stateId }))).not.toContain("jeton-P1");

    expect(await flow.confirm()).toBe(1);
    const accounts = await collections(db).socialAccounts.find({ workspaceId: alice.workspace._id }).toArray();
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ provider: "meta", network: "facebook", externalAccountId: "P1", status: "connected" });
    expect(JSON.stringify(accounts[0])).not.toContain("jeton-P1");
    expect(decryptSecret(accounts[0]?.accessToken as NonNullable<SocialAccountDoc["accessToken"]>, key)).toBe("jeton-P1");
    // Usage unique.
    await expect(flow.confirm()).rejects.toMatchObject({ code: "not_found" });
  });

  it("l'état est lié à l'utilisateur et à l'espace", async () => {
    const stateId = await startOAuthConnection(db, alice, "alice", "meta");
    await expect(
      receiveOAuthCallback(db, { stateId, userId: "bob", provider: "meta", encryptionKey: key, exchange: async () => [page("X")] }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      receiveOAuthCallback(db, { stateId, userId: "alice", provider: "linkedin", encryptionKey: key, exchange: async () => [page("X")] }),
    ).rejects.toMatchObject({ code: "conflict" });
    await receiveOAuthCallback(db, { stateId, userId: "alice", provider: "meta", encryptionKey: key, exchange: async () => [page("X")] });
    // Rejouer le retour du réseau échoue.
    const exchange = vi.fn(async () => [page("Y")]);
    await expect(receiveOAuthCallback(db, { stateId, userId: "alice", provider: "meta", encryptionKey: key, exchange })).rejects.toMatchObject({
      code: "conflict",
    });
    expect(exchange).not.toHaveBeenCalled();
    // Bob ne peut ni voir ni valider la demande d'Alice.
    await expect(getPendingConnection(db, bob, "bob", stateId)).rejects.toMatchObject({ code: "not_found" });
    await expect(confirmOAuthConnection(db, bob, "bob", stateId, ["facebook:X"])).rejects.toMatchObject({ code: "not_found" });
  });

  it("demande expirée → refusée", async () => {
    const stateId = await startOAuthConnection(db, alice, "alice", "meta", new Date(Date.now() - 3600_000));
    await expect(
      receiveOAuthCallback(db, { stateId, userId: "alice", provider: "meta", encryptionKey: key, exchange: async () => [page("X")] }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("applique la limite de l'offre (2 comptes en gratuit), hors comptes de test, reconnexion comprise", async () => {
    await connectSimulationAccount(db, alice, "alice", "facebook", true);
    await (await connect(alice, "alice", [page("A"), page("B")])).confirm();
    expect(await collections(db).socialAccounts.countDocuments({ workspaceId: alice.workspace._id })).toBe(3);

    const extra = await connect(alice, "alice", [page("C")]);
    await expect(extra.confirm()).rejects.toMatchObject({ code: "limit_reached" });

    // Reconnecter un compte existant reste possible à la limite, et met à jour son jeton.
    await collections(db).socialAccounts.updateOne({ externalAccountId: "A" }, { $set: { status: "expired" } });
    await (await connect(alice, "alice", [{ ...page("A"), accessToken: "nouveau" }])).confirm();
    const a = await collections(db).socialAccounts.findOne({ workspaceId: alice.workspace._id, externalAccountId: "A" });
    expect(a?.status).toBe("connected");
    expect(decryptSecret(a?.accessToken as NonNullable<SocialAccountDoc["accessToken"]>, key)).toBe("nouveau");
    expect(await collections(db).socialAccounts.countDocuments({ workspaceId: alice.workspace._id })).toBe(3);
  });

  it("un lecteur ne peut pas connecter de compte", async () => {
    await expect(startOAuthConnection(db, { ...alice, role: "viewer" }, "alice", "meta")).rejects.toMatchObject({ code: "forbidden" });
  });

  it("le compte choisi pour une publication doit être du même espace et du même réseau", async () => {
    await (await connect(alice, "alice", [page("P1"), page("IG1", "instagram")])).confirm();
    await (await connect(bob, "bob", [page("BOB")])).confirm();
    const now = new Date();
    const postId = new ObjectId();
    await collections(db).posts.insertOne({
      _id: postId,
      workspaceId: alice.workspace._id,
      brandId: new ObjectId(),
      network: "facebook",
      status: "draft",
      text: "x",
      rationale: "",
      generationJobId: null,
      scheduledAt: null,
      timeZone: "Europe/Paris",
      publishedAt: null,
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
    const find = (id: string) => collections(db).socialAccounts.findOne({ externalAccountId: id });
    const p1 = await find("P1");
    const ig = await find("IG1");
    const other = await find("BOB");
    expect((await setPostAccount(db, alice, postId.toHexString(), p1?._id.toHexString()))?.socialAccountId?.equals(p1?._id as ObjectId)).toBe(true);
    await expect(setPostAccount(db, alice, postId.toHexString(), ig?._id.toHexString())).rejects.toMatchObject({ code: "not_found" });
    await expect(setPostAccount(db, alice, postId.toHexString(), other?._id.toHexString())).rejects.toMatchObject({ code: "not_found" });
    expect((await setPostAccount(db, alice, postId.toHexString(), null)).socialAccountId).toBeNull();
  });

  it("entretien des autorisations : renouvelle Threads, prévient une fois, marque les comptes expirés", async () => {
    const now = new Date("2030-06-01T00:00:00Z");
    const day = 24 * 3600_000;
    const insert = (id: string, provider: SocialAccountDoc["provider"], expiresInDays: number, updatedDaysAgo = 30) =>
      collections(db).socialAccounts.insertOne({
        _id: new ObjectId(),
        workspaceId: alice.workspace._id,
        network: provider === "threads" ? "threads" : "linkedin",
        provider,
        externalAccountId: id,
        displayName: id,
        status: "connected",
        scopes: [],
        accessToken: encryptSecret(`jeton-${id}`, key),
        refreshToken: null,
        tokenExpiresAt: new Date(now.getTime() + expiresInDays * day),
        lastCheckedAt: null,
        lastError: null,
        connectedByUserId: "alice",
        createdAt: now,
        updatedAt: new Date(now.getTime() - updatedDaysAgo * day),
      });
    await insert("threads-a-renouveler", "threads", 8);
    await insert("threads-trop-recent", "threads", 8, 0);
    await insert("linkedin-bientot", "linkedin", 5);
    await insert("linkedin-expire", "linkedin", -1);
    await insert("linkedin-ok", "linkedin", 40);

    const notifier = { accountExpired: vi.fn(async () => {}), accountExpiring: vi.fn(async () => {}) };
    const refreshThreads = vi.fn(async (token: string) => ({ accessToken: `${token}-neuf`, tokenExpiresAt: new Date(now.getTime() + 60 * day) }));
    const summary = await maintainSocialTokens({ db, encryptionKey: key, notifier, refreshThreads, now });
    // linkedin-bientot (5 jours) est prévenu ; threads-trop-recent (8 jours) pas encore.
    expect(summary).toEqual({ refreshed: 1, warned: 1, expired: 1 });
    expect(refreshThreads).toHaveBeenCalledWith("jeton-threads-a-renouveler", now);
    const refreshed = await collections(db).socialAccounts.findOne({ externalAccountId: "threads-a-renouveler" });
    expect(decryptSecret(refreshed?.accessToken as NonNullable<SocialAccountDoc["accessToken"]>, key)).toBe("jeton-threads-a-renouveler-neuf");
    expect((await collections(db).socialAccounts.findOne({ externalAccountId: "linkedin-expire" }))?.status).toBe("expired");

    // Deux jours plus tard : threads-trop-recent passe sous 7 jours (non renouvelé ici) ; chaque compte n'est prévenu qu'une fois.
    const later = new Date(now.getTime() + 2 * day);
    const second = await maintainSocialTokens({ db, encryptionKey: key, notifier, now: later });
    const third = await maintainSocialTokens({ db, encryptionKey: key, notifier, now: later });
    expect(second.warned).toBe(1);
    expect(third.warned).toBe(0);
    expect(notifier.accountExpiring).toHaveBeenCalledTimes(2);
    expect(notifier.accountExpired).toHaveBeenCalledTimes(1);
  });
});

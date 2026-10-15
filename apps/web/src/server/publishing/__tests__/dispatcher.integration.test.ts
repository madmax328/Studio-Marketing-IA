/**
 * File d'envoi sur une vraie base MongoDB (TEST_MONGODB_URI, fourni en CI).
 * Les connecteurs et les notifications sont simulés.
 */
import { randomBytes } from "node:crypto";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { collections, type PostDoc } from "@/server/db/collections";
import { runMigrations } from "@/server/db/migrations";
import { runPublishingCycle, type DispatcherDeps, type Notifier } from "@/server/publishing/dispatcher";
import { simulationPublisher } from "@/server/publishing/publishers/simulation";
import { PublishError, type SocialPublisher } from "@/server/publishing/types";
import { encryptSecret } from "@/server/security/crypto";

const uri = process.env.TEST_MONGODB_URI;
const key = randomBytes(32).toString("base64");

describe.skipIf(!uri)("file d'envoi (MongoDB réel)", () => {
  let client: MongoClient;
  let db: Db;
  const workspaceId = new ObjectId();
  const brandId = new ObjectId();
  let clock = new Date("2030-01-01T10:00:00Z");
  const notifier = {
    publishFailed: vi.fn<Notifier["publishFailed"]>(async () => {}),
    accountExpired: vi.fn<Notifier["accountExpired"]>(async () => {}),
  };

  function deps(publishers: DispatcherDeps["publishers"]): DispatcherDeps {
    return { db, publishers, notifier, encryptionKey: key, mediaFor: async () => [], now: () => clock };
  }

  async function addPost(overrides: Partial<PostDoc> = {}): Promise<ObjectId> {
    const post: PostDoc = {
      _id: new ObjectId(),
      workspaceId,
      brandId,
      network: "linkedin",
      status: "scheduled",
      text: "Bonjour",
      rationale: "",
      generationJobId: null,
      scheduledAt: new Date(clock.getTime() - 60_000),
      timeZone: "Europe/Paris",
      publishedAt: null,
      schemaVersion: 1,
      createdAt: clock,
      updatedAt: clock,
      ...overrides,
    };
    await collections(db).posts.insertOne(post);
    return post._id;
  }

  async function addAccount(provider: "simulation" | "linkedin", network: PostDoc["network"] = "linkedin") {
    await collections(db).socialAccounts.insertOne({
      _id: new ObjectId(),
      workspaceId,
      network,
      provider,
      externalAccountId: `${provider}-${network}`,
      displayName: `Compte ${provider}`,
      status: "connected",
      scopes: [],
      accessToken: provider === "linkedin" ? encryptSecret("jeton", key) : null,
      refreshToken: null,
      tokenExpiresAt: null,
      lastCheckedAt: null,
      lastError: null,
      connectedByUserId: "alice",
      createdAt: clock,
      updatedAt: clock,
    });
  }

  const get = (id: ObjectId) => collections(db).posts.findOne({ _id: id });

  beforeAll(async () => {
    client = new MongoClient(uri as string);
    await client.connect();
    db = client.db(`smia_test_pub_${Date.now()}`);
    await runMigrations(db, () => {});
  });

  beforeEach(async () => {
    await collections(db).posts.deleteMany({});
    await collections(db).socialAccounts.deleteMany({});
    notifier.publishFailed.mockClear();
    notifier.accountExpired.mockClear();
    clock = new Date("2030-01-01T10:00:00Z");
  });

  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  it("envoie en simulation, marque la publication et ne touche pas aux brouillons ni aux envois futurs", async () => {
    await addAccount("simulation");
    const due = await addPost();
    const draft = await addPost({ status: "draft" });
    const future = await addPost({ scheduledAt: new Date(clock.getTime() + 3600_000) });

    const summary = await runPublishingCycle(deps({ simulation: simulationPublisher }));
    expect(summary.published).toBe(1);
    const sent = await get(due);
    expect(sent?.status).toBe("published");
    expect(sent?.publishing?.simulated).toBe(true);
    expect(sent?.publishing?.lockId).toBeNull();
    expect((await get(draft))?.status).toBe("draft");
    expect((await get(future))?.status).toBe("scheduled");
  });

  it("échoue avec une raison claire et notifie quand aucun compte n'est connecté", async () => {
    const id = await addPost();
    await runPublishingCycle(deps({ simulation: simulationPublisher }));
    const post = await get(id);
    expect(post?.status).toBe("failed");
    expect(post?.publishing?.lastError).toContain("Aucun compte LinkedIn");
    expect(notifier.publishFailed).toHaveBeenCalledTimes(1);
  });

  it("refuse d'envoyer un contenu devenu invalide (Instagram sans image)", async () => {
    await addAccount("simulation", "instagram");
    const id = await addPost({ network: "instagram" });
    await runPublishingCycle(deps({ simulation: simulationPublisher }));
    expect((await get(id))?.publishing?.lastError).toContain("exige une image");
  });

  it("réessaie une erreur temporaire avec délai, puis abandonne après 3 tentatives", async () => {
    await addAccount("linkedin");
    const publish = vi.fn<SocialPublisher["publish"]>(async () => {
      throw new PublishError("LinkedIn ne répond pas.", "retryable");
    });
    const publishers = { linkedin: { provider: "linkedin" as const, publish } };
    const id = await addPost();

    await runPublishingCycle(deps(publishers));
    let post = await get(id);
    expect(post?.status).toBe("scheduled");
    expect(post?.publishing?.nextAttemptAt?.toISOString()).toBe("2030-01-01T10:05:00.000Z");

    await runPublishingCycle(deps(publishers)); // trop tôt : rien ne se passe
    expect(publish).toHaveBeenCalledTimes(1);

    clock = new Date("2030-01-01T10:06:00Z");
    await runPublishingCycle(deps(publishers));
    clock = new Date("2030-01-01T10:30:00Z");
    await runPublishingCycle(deps(publishers));
    post = await get(id);
    expect(publish).toHaveBeenCalledTimes(3);
    expect(post?.status).toBe("failed");
    expect(post?.publishing?.lastError).toContain("3 tentatives");
    expect(notifier.publishFailed).toHaveBeenCalledTimes(1);
  });

  it("ne réessaie jamais un envoi au résultat incertain (évite les doublons)", async () => {
    await addAccount("linkedin");
    const publish = vi.fn<SocialPublisher["publish"]>(async () => {
      throw new Error("socket hang up");
    });
    const id = await addPost();
    await runPublishingCycle(deps({ linkedin: { provider: "linkedin", publish } }));
    clock = new Date("2030-01-02T10:00:00Z");
    await runPublishingCycle(deps({ linkedin: { provider: "linkedin", publish } }));
    expect(publish).toHaveBeenCalledTimes(1);
    expect((await get(id))?.publishing?.lastError).toContain("vérifiez sur le réseau");
  });

  it("marque le compte à reconnecter quand le jeton est refusé", async () => {
    await addAccount("linkedin");
    const id = await addPost();
    await runPublishingCycle(
      deps({
        linkedin: {
          provider: "linkedin",
          publish: async () => {
            throw new PublishError("Jeton refusé.", "auth");
          },
        },
      }),
    );
    expect((await get(id))?.status).toBe("failed");
    expect((await collections(db).socialAccounts.findOne({ workspaceId }))?.status).toBe("expired");
    expect(notifier.accountExpired).toHaveBeenCalledTimes(1);
  });

  it("deux passages simultanés n'envoient chaque publication qu'une fois", async () => {
    await addAccount("linkedin");
    const publish = vi.fn<SocialPublisher["publish"]>(async ({ post }) => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { externalId: post._id.toHexString(), externalUrl: null, simulated: false };
    });
    const ids = await Promise.all(Array.from({ length: 5 }, () => addPost()));
    const publishers = { linkedin: { provider: "linkedin" as const, publish } };
    await Promise.all([runPublishingCycle(deps(publishers)), runPublishingCycle(deps(publishers)), runPublishingCycle(deps(publishers))]);
    expect(publish).toHaveBeenCalledTimes(5);
    for (const id of ids) expect((await get(id))?.status).toBe("published");
  });

  it("clôt un traitement interrompu sans le relancer, et prévient l'utilisateur", async () => {
    const id = await addPost({
      status: "processing",
      publishing: {
        attempts: 1,
        nextAttemptAt: null,
        lockedAt: new Date(clock.getTime() - 20 * 60_000),
        lockId: "ancien",
        socialAccountId: null,
        externalId: null,
        externalUrl: null,
        simulated: false,
        lastError: null,
        lastAttemptAt: null,
      },
    });
    const summary = await runPublishingCycle(deps({}));
    expect(summary.recovered).toBe(1);
    expect((await get(id))?.status).toBe("failed");
    expect(notifier.publishFailed).toHaveBeenCalledTimes(1);
  });
});

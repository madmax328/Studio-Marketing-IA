/**
 * Campagnes et calendrier sur une vraie base MongoDB (TEST_MONGODB_URI, fourni en CI).
 * Le fournisseur d'IA est simulé.
 */
import { MongoClient, ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, toZoned } from "@smia/shared";
import { collections } from "@/server/db/collections";
import { runMigrations } from "@/server/db/migrations";
import { createBrand } from "@/server/services/brands";
import {
  createCampaign,
  generateCampaignBatch,
  getCampaign,
  proposeStrategy,
  regenerateCampaignPost,
  saveStrategy,
  scheduleCampaignPosts,
} from "@/server/services/campaigns";
import { acceptAiConsent } from "@/server/services/generation";
import { createDraft, duplicatePost, listCalendarPosts, setPostSchedule, unschedulePost } from "@/server/services/posts";
import { ensurePersonalWorkspace, getWorkspaceAccess, type WorkspaceAccess } from "@/server/services/workspaces";
import { fakeTextProvider } from "@/test/fake-text-provider";

const uri = process.env.TEST_MONGODB_URI;
const tz = "Europe/Paris";

describe.skipIf(!uri)("campagnes et calendrier (MongoDB réel)", () => {
  let client: MongoClient;
  let db: Db;
  let alice: WorkspaceAccess;
  let bob: WorkspaceAccess;
  let brandId: string;
  const { provider, generateCampaignPosts } = fakeTextProvider();
  const today = toZoned(new Date(), tz).date;
  const start = addDays(today, 3);

  beforeAll(async () => {
    client = new MongoClient(uri as string);
    await client.connect();
    db = client.db(`smia_test_camp_${Date.now()}`);
    await runMigrations(db, () => {});
    const a = await ensurePersonalWorkspace(db, { id: "alice", name: "Alice" });
    const b = await ensurePersonalWorkspace(db, { id: "bob", name: "Bob" });
    alice = (await getWorkspaceAccess(db, "alice", a._id.toHexString()))!;
    bob = (await getWorkspaceAccess(db, "bob", b._id.toHexString()))!;
    brandId = (await createBrand(db, alice, "alice", { name: "Café", timeZone: tz }))._id.toHexString();
    await acceptAiConsent(db, alice, "alice", provider);
    await collections(db).workspaces.updateOne({ _id: alice.workspace._id }, { $set: { "limitOverrides.monthlyCredits": 100 } });
    alice = (await getWorkspaceAccess(db, "alice", a._id.toHexString()))!;
  });

  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  describe("programmation d'une publication", () => {
    it("refuse une date passée et une heure inexistante, accepte une date future en heure locale", async () => {
      const post = await createDraft(db, alice, "alice", { brandId, network: "linkedin", text: "Bonjour" });
      const id = post._id.toHexString();

      await expect(setPostSchedule(db, alice, "alice", id, { date: "2020-01-01", time: "10:00" }, "schedule")).rejects.toMatchObject({
        code: "invalid_input",
      });
      await expect(setPostSchedule(db, alice, "alice", id, { date: "2030-03-31", time: "02:30" }, "schedule")).rejects.toThrow(
        "changement d'heure",
      );

      const scheduled = await setPostSchedule(db, alice, "alice", id, { date: "2030-07-15", time: "12:00" }, "schedule");
      expect(scheduled.status).toBe("scheduled");
      expect(scheduled.scheduledAt?.toISOString()).toBe("2030-07-15T10:00:00.000Z");

      const back = await unschedulePost(db, alice, "alice", id);
      expect(back.status).toBe("draft");
      expect(back.scheduledAt?.toISOString()).toBe("2030-07-15T10:00:00.000Z");
    });

    it("refuse de programmer un post Instagram sans image", async () => {
      const post = await createDraft(db, alice, "alice", { brandId, network: "instagram", text: "Sans image" });
      await expect(
        setPostSchedule(db, alice, "alice", post._id.toHexString(), { date: "2030-07-15", time: "12:00" }, "schedule"),
      ).rejects.toThrow("exige une image");
      // Mais on peut noter une date sur le brouillon.
      const planned = await setPostSchedule(db, alice, "alice", post._id.toHexString(), { date: "2030-07-15", time: "12:00" }, "plan");
      expect(planned.status).toBe("draft");
    });

    it("duplique en brouillon sans date et n'expose rien à un autre espace", async () => {
      const post = await createDraft(db, alice, "alice", { brandId, network: "x", text: "À copier" });
      await setPostSchedule(db, alice, "alice", post._id.toHexString(), { date: "2030-08-01", time: "09:00" }, "schedule");
      const copy = await duplicatePost(db, alice, "alice", post._id.toHexString());
      expect(copy.status).toBe("draft");
      expect(copy.scheduledAt).toBeNull();
      await expect(duplicatePost(db, bob, "bob", post._id.toHexString())).rejects.toMatchObject({ code: "not_found" });

      const range = [new Date("2030-07-01T00:00:00Z"), new Date("2030-09-01T00:00:00Z")] as const;
      expect((await listCalendarPosts(db, alice, ...range)).length).toBeGreaterThan(0);
      expect(await listCalendarPosts(db, bob, ...range)).toHaveLength(0);
    });
  });

  describe("campagne de bout en bout", () => {
    let campaignId: string;

    it("crée la campagne et refuse une période trop chargée", async () => {
      await expect(
        createCampaign(db, alice, "alice", {
          brandId, name: "Trop", objective: "notoriete", networks: ["linkedin"], startDate: start, endDate: addDays(start, 80), postsPerWeek: 7,
        }),
      ).rejects.toMatchObject({ code: "invalid_input" });

      const campaign = await createCampaign(db, alice, "alice", {
        brandId, name: "Automne", objective: "evenement", networks: ["linkedin", "facebook"],
        highlights: "Soirée dégustation", startDate: start, endDate: addDays(start, 13), postsPerWeek: 3, defaultTime: "18:30",
      });
      campaignId = campaign._id.toHexString();
      expect(campaign.timeZone).toBe(tz);
    });

    it("propose une stratégie dont les dates sont calculées par l'application", async () => {
      const campaign = await proposeStrategy(db, alice, "alice", campaignId, crypto.randomUUID(), provider);
      expect(campaign.status).toBe("strategy");
      expect(campaign.strategy?.slots).toHaveLength(6);
      expect(campaign.strategy?.slots.every((s) => s.time === "18:30" && s.date >= start)).toBe(true);
    });

    it("refuse un créneau hors de la période puis valide la stratégie modifiée", async () => {
      const campaign = await getCampaign(db, alice, campaignId);
      const strategy = campaign.strategy!;
      await expect(
        saveStrategy(db, alice, "alice", campaignId, { ...strategy, slots: [{ ...strategy.slots[0]!, date: addDays(start, -1) }] }, true),
      ).rejects.toMatchObject({ code: "invalid_input" });

      const edited = { ...strategy, slots: strategy.slots.slice(0, 5).map((s, i) => (i === 0 ? { ...s, theme: "Ouverture de la saison" } : s)) };
      const saved = await saveStrategy(db, alice, "alice", campaignId, edited, true);
      expect(saved.status).toBe("validated");
      expect(saved.strategy?.slots).toHaveLength(5);
    });

    it("rédige par lots, sans doublon, et date les brouillons dans le fuseau de la campagne", async () => {
      const first = await generateCampaignBatch(db, alice, "alice", campaignId, crypto.randomUUID(), provider);
      expect(first.created).toBe(8); // 4 créneaux × 2 réseaux
      expect(first.remaining).toBe(1);
      const second = await generateCampaignBatch(db, alice, "alice", campaignId, crypto.randomUUID(), provider);
      expect(second.created).toBe(2);
      expect(second.remaining).toBe(0);
      const third = await generateCampaignBatch(db, alice, "alice", campaignId, crypto.randomUUID(), provider);
      expect(third.created).toBe(0);
      expect(generateCampaignPosts).toHaveBeenCalledTimes(2);

      const posts = await collections(db).posts.find({ campaignId: new ObjectId(campaignId) }).toArray();
      expect(posts).toHaveLength(10);
      expect(posts.every((p) => p.status === "draft" && p.scheduledAt && toZoned(p.scheduledAt, tz).time === "18:30")).toBe(true);
      expect(posts.some((p) => p.text.startsWith("Ouverture de la saison"))).toBe(true);
    });

    it("régénère une seule publication", async () => {
      const post = await collections(db).posts.findOne({ campaignId: new ObjectId(campaignId), network: "facebook" });
      const before = await collections(db).posts.countDocuments({ campaignId: new ObjectId(campaignId) });
      const updated = await regenerateCampaignPost(db, alice, "alice", post!._id.toHexString(), crypto.randomUUID(), provider);
      expect(updated._id.equals(post!._id)).toBe(true);
      expect(await collections(db).posts.countDocuments({ campaignId: new ObjectId(campaignId) })).toBe(before);
    });

    it("programme les brouillons prêts d'un coup", async () => {
      const result = await scheduleCampaignPosts(db, alice, "alice", campaignId);
      expect(result.scheduled).toBe(10);
      expect(result.skipped).toEqual([]);
    });

    it("isole les campagnes entre espaces", async () => {
      await expect(getCampaign(db, bob, campaignId)).rejects.toMatchObject({ code: "not_found" });
      await expect(scheduleCampaignPosts(db, bob, "bob", campaignId)).rejects.toMatchObject({ code: "not_found" });
    });
  });
});

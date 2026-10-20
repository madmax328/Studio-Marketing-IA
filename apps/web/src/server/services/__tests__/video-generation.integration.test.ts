/**
 * Vidéos par IA sur une vraie base MongoDB (TEST_MONGODB_URI, fourni en CI). Fournisseur et stockage simulés ;
 * les vidéos « reçues » sont de vrais fichiers (H.264/AAC accepté, VP9 refusé).
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MongoClient, type Db } from "mongodb";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CREDIT_COSTS } from "@smia/shared";
import type { VideoGenerationProvider, VideoJobState } from "@/server/ai/types";
import { collections } from "@/server/db/collections";
import { runMigrations } from "@/server/db/migrations";
import type { MediaStorage } from "@/server/media/storage";
import { getCreditAccount } from "@/server/services/billing";
import { createBrand } from "@/server/services/brands";
import { acceptAiConsent } from "@/server/services/generation";
import { advancePendingVideos, pollVideoGeneration, startVideoGeneration } from "@/server/services/video-generation";
import { ensurePersonalWorkspace, getWorkspaceAccess, type WorkspaceAccess } from "@/server/services/workspaces";

const uri = process.env.TEST_MONGODB_URI;
const fixtures = join(__dirname, "../../media/__tests__/fixtures");
const publishable = readFileSync(join(fixtures, "h264-aac-360x640-2s.mp4"));
const vp9 = readFileSync(join(fixtures, "vp9-360x640-2s.mp4"));

describe.skipIf(!uri)("vidéos par IA (MongoDB réel)", () => {
  let client: MongoClient;
  let db: Db;
  let access: WorkspaceAccess;
  let brandId: string;
  const files = new Map<string, Buffer>();
  const storage: MediaStorage = {
    isConfigured: () => true,
    put: async (key, body) => void files.set(key, body),
    read: async () => null,
    readBuffer: async (key) => files.get(key) ?? null,
    stat: async () => null,
    remove: async (keys) => keys.forEach((key) => files.delete(key)),
  };
  const states = new Map<string, VideoJobState>();
  const contents = new Map<string, Buffer>();
  let counter = 0;
  const provider: VideoGenerationProvider = {
    id: "fake-video",
    label: "Vidéos de test",
    dataProcessor: "Test",
    isConfigured: () => true,
    startVideo: vi.fn(async () => ({ id: `v${(counter += 1)}`, model: "test" })),
    getVideo: vi.fn(async (id: string): Promise<VideoJobState> => states.get(id) ?? { status: "queued", progress: 0, error: null }),
    downloadVideo: vi.fn(async (id: string, variant: "video" | "thumbnail") =>
      variant === "thumbnail" ? sharp({ create: { width: 36, height: 64, channels: 3, background: "#ff7a45" } }).png().toBuffer() : (contents.get(id) ?? Buffer.alloc(0)),
    ),
  };
  const request = (seconds: 4 | 8 = 4) => ({ requestId: randomUUID(), brandId, description: "Une tasse de café fumante au lever du soleil", orientation: "vertical", seconds });
  const used = async () => (await getCreditAccount(db, access.workspace)).used;

  beforeAll(async () => {
    client = new MongoClient(uri as string);
    await client.connect();
    db = client.db(`smia_test_aivideo_${Date.now()}`);
    await runMigrations(db, () => {});
    const workspace = await ensurePersonalWorkspace(db, { id: "alice", name: "Alice" });
    // Offre Agence : assez de crédits pour plusieurs vidéos.
    await collections(db).workspaces.updateOne({ _id: workspace._id }, { $set: { limitOverrides: { monthlyCredits: 200 } } });
    access = (await getWorkspaceAccess(db, "alice", workspace._id.toHexString()))!;
    brandId = (await createBrand(db, access, "alice", { name: "Café du Port", industry: "Café" }))._id.toHexString();
  });

  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  it("exige l'accord, débite selon la durée, suit l'avancement puis range la vidéo vérifiée", async () => {
    await expect(startVideoGeneration(db, access, "alice", request(), provider, storage)).rejects.toMatchObject({ code: "consent_required" });
    await acceptAiConsent(db, access, "alice", provider);
    access = (await getWorkspaceAccess(db, "alice", access.workspace._id.toHexString()))!;

    const input = request(8);
    const { jobId } = await startVideoGeneration(db, access, "alice", input, provider, storage);
    // Double clic : même création, un seul débit.
    expect((await startVideoGeneration(db, access, "alice", input, provider, storage)).jobId).toBe(jobId);
    expect(await used()).toBe(CREDIT_COSTS.video_generation_8s);
    expect(provider.startVideo).toHaveBeenCalledWith(expect.objectContaining({ orientation: "vertical", seconds: 8, prompt: expect.stringContaining("aucun texte") }));

    states.set("v1", { status: "in_progress", progress: 37, error: null });
    expect(await pollVideoGeneration(db, access, jobId, provider, storage)).toEqual({ status: "processing", progress: 37 });

    states.set("v1", { status: "completed", progress: 100, error: null });
    contents.set("v1", publishable);
    const done = await pollVideoGeneration(db, access, jobId, provider, storage);
    expect(done.status).toBe("done");
    const media = await collections(db).mediaAssets.findOne({ workspaceId: access.workspace._id, kind: "video" });
    expect(media).toMatchObject({ source: "ai", mimeType: "video/mp4", width: 360, height: 640, durationSeconds: 2 });
    expect(files.get(media?.storageKey ?? "")?.length).toBe(publishable.length);
    expect(media?.posterStorageKey && files.has(media.posterStorageKey)).toBe(true);
    // Suivi suivant : rien de plus.
    expect(await pollVideoGeneration(db, access, jobId, provider, storage)).toEqual({ status: "done", mediaId: media?._id.toHexString() });
    expect(await collections(db).mediaAssets.countDocuments({ kind: "video" })).toBe(1);
  });

  it("vidéo refusée (format non publiable) ou échec chez le fournisseur : crédits rendus", async () => {
    const before = await used();
    const a = await startVideoGeneration(db, access, "alice", request(), provider, storage);
    states.set("v2", { status: "completed", progress: 100, error: null });
    contents.set("v2", vp9);
    const rejected = await pollVideoGeneration(db, access, a.jobId, provider, storage);
    expect(rejected).toMatchObject({ status: "failed", error: expect.stringContaining("H.264") });

    const b = await startVideoGeneration(db, access, "alice", request(), provider, storage);
    states.set("v3", { status: "failed", progress: null, error: "contenu refusé" });
    expect(await pollVideoGeneration(db, access, b.jobId, provider, storage)).toMatchObject({ status: "failed" });
    expect(await used()).toBe(before);
  });

  it("le planificateur termine une vidéo dont la page a été fermée", async () => {
    const { jobId } = await startVideoGeneration(db, access, "alice", request(), provider, storage);
    states.set("v4", { status: "completed", progress: 100, error: null });
    contents.set("v4", publishable);
    const later = new Date(Date.now() + 2 * 60_000);
    expect(await advancePendingVideos(db, provider, storage, Date.now() + 20_000, later)).toBe(1);
    expect(await pollVideoGeneration(db, access, jobId, provider, storage)).toMatchObject({ status: "done" });
  });
});

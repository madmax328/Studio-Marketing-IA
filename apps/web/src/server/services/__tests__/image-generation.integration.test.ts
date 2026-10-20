/**
 * Création d'images par IA sur une vraie base MongoDB (TEST_MONGODB_URI, fourni en CI).
 * Le fournisseur d'images et le stockage sont simulés.
 */
import { randomUUID } from "node:crypto";
import { MongoClient, type Db } from "mongodb";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CREDIT_COSTS } from "@smia/shared";
import { TextGenerationError, type ImageGenerationProvider } from "@/server/ai/types";
import { collections } from "@/server/db/collections";
import { runMigrations } from "@/server/db/migrations";
import type { MediaStorage } from "@/server/media/storage";
import { getCreditAccount } from "@/server/services/billing";
import { createBrand } from "@/server/services/brands";
import { acceptAiConsent } from "@/server/services/generation";
import { generateAiImage } from "@/server/services/image-generation";
import { ensurePersonalWorkspace, getWorkspaceAccess, type WorkspaceAccess } from "@/server/services/workspaces";

const uri = process.env.TEST_MONGODB_URI;

describe.skipIf(!uri)("création d'images par IA (MongoDB réel)", () => {
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
  const generateImage = vi.fn<ImageGenerationProvider["generateImage"]>(async () => ({
    output: await sharp({ create: { width: 1024, height: 1536, channels: 3, background: "#e76f51" } }).png().toBuffer(),
    model: "test",
    usage: { inputTokens: 0, outputTokens: 0 },
  }));
  const provider: ImageGenerationProvider = { id: "fake-images", label: "Images de test", dataProcessor: "Test", isConfigured: () => true, generateImage };

  const refresh = async () => {
    access = (await getWorkspaceAccess(db, "alice", access.workspace._id.toHexString()))!;
  };

  beforeAll(async () => {
    client = new MongoClient(uri as string);
    await client.connect();
    db = client.db(`smia_test_images_${Date.now()}`);
    await runMigrations(db, () => {});
    const workspace = await ensurePersonalWorkspace(db, { id: "alice", name: "Alice" });
    access = (await getWorkspaceAccess(db, "alice", workspace._id.toHexString()))!;
    brandId = (await createBrand(db, access, "alice", { name: "Studio Ananda", industry: "Yoga", brandColors: ["#264653"] }))._id.toHexString();
  });

  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  const request = (overrides: Record<string, unknown> = {}) => ({ requestId: randomUUID(), brandId, description: "un tapis de yoga au soleil", format: "portrait", ...overrides });

  it("exige un accord propre au fournisseur d'images", async () => {
    await expect(generateAiImage(db, access, "alice", request(), provider, storage)).rejects.toMatchObject({ code: "consent_required" });
    expect(generateImage).not.toHaveBeenCalled();
  });

  it("crée l'image au format exact, l'ajoute à la médiathèque et débite les crédits une seule fois", async () => {
    await acceptAiConsent(db, access, "alice", provider);
    await refresh();
    const input = request();
    const { mediaId } = await generateAiImage(db, access, "alice", input, provider, storage);
    // Même demande renvoyée (double clic) : aucune nouvelle image, aucun nouveau débit.
    expect((await generateAiImage(db, access, "alice", input, provider, storage)).mediaId).toBe(mediaId);
    expect(generateImage).toHaveBeenCalledTimes(1);

    const media = await collections(db).mediaAssets.findOne({ workspaceId: access.workspace._id, source: "ai" });
    expect(media).toMatchObject({ width: 1080, height: 1350, mimeType: "image/jpeg" });
    const stored = files.get(media?.storageKey ?? "");
    expect(stored && (await sharp(stored).metadata())).toMatchObject({ width: 1080, height: 1350, format: "jpeg" });
    expect((await getCreditAccount(db, access.workspace)).used).toBe(CREDIT_COSTS.image_generation);
  });

  it("rembourse les crédits si la création échoue", async () => {
    const before = (await getCreditAccount(db, access.workspace)).used;
    generateImage.mockRejectedValueOnce(new TextGenerationError("Refusé par le filtre.", false));
    await expect(generateAiImage(db, access, "alice", request(), provider, storage)).rejects.toMatchObject({ message: "Refusé par le filtre." });
    expect((await getCreditAccount(db, access.workspace)).used).toBe(before);
  });

  it("l'accord donné pour les images ne remplace pas celui du texte (et inversement)", async () => {
    const workspace = await collections(db).workspaces.findOne({ _id: access.workspace._id });
    expect(workspace?.aiConsents?.["fake-images"]).toBeTruthy();
    expect(workspace?.aiConsents?.anthropic).toBeUndefined();
  });
});

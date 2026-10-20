/**
 * Voix off sur une vraie base MongoDB (TEST_MONGODB_URI, fourni en CI).
 * Le fournisseur de voix et le stockage sont simulés.
 */
import { randomUUID } from "node:crypto";
import { MongoClient, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CREDIT_COSTS } from "@smia/shared";
import { TextGenerationError, type SpeechGenerationProvider } from "@/server/ai/types";
import { collections } from "@/server/db/collections";
import { runMigrations } from "@/server/db/migrations";
import type { MediaStorage } from "@/server/media/storage";
import { getCreditAccount } from "@/server/services/billing";
import { createBrand } from "@/server/services/brands";
import { acceptAiConsent } from "@/server/services/generation";
import { generateVoiceover, getVoiceoverClip, purgeOldVoiceovers, VOICEOVER_RETENTION_MS } from "@/server/services/voiceover";
import { ensurePersonalWorkspace, getWorkspaceAccess, type WorkspaceAccess } from "@/server/services/workspaces";

const uri = process.env.TEST_MONGODB_URI;

/** Fichier WAV muet de la durée demandée (lisible par l'analyse audio du serveur). */
function wav(seconds: number): Buffer {
  const rate = 8000;
  const samples = Math.round(rate * seconds);
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  return buffer;
}

describe.skipIf(!uri)("voix off (MongoDB réel)", () => {
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
  const generateSpeech = vi.fn<SpeechGenerationProvider["generateSpeech"]>(async ({ text }) => ({
    output: wav(text.length / 10),
    model: "test",
    usage: { inputTokens: text.length, outputTokens: 0 },
  }));
  const provider: SpeechGenerationProvider = { id: "fake-speech", label: "Voix de test", dataProcessor: "Test", isConfigured: () => true, generateSpeech };

  beforeAll(async () => {
    client = new MongoClient(uri as string);
    await client.connect();
    db = client.db(`smia_test_voice_${Date.now()}`);
    await runMigrations(db, () => {});
    const workspace = await ensurePersonalWorkspace(db, { id: "alice", name: "Alice" });
    access = (await getWorkspaceAccess(db, "alice", workspace._id.toHexString()))!;
    brandId = (await createBrand(db, access, "alice", { name: "Studio Ananda", industry: "Yoga", brandColors: ["#264653"] }))._id.toHexString();
  });

  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  const request = (overrides: Record<string, unknown> = {}) => ({
    requestId: randomUUID(),
    brandId,
    voice: "sage",
    lines: [
      { slide: 0, text: "Bienvenue au studio, vingt caractères." },
      { slide: 2, text: "Premier cours offert." },
    ],
    ...overrides,
  });

  it("exige un accord propre au fournisseur de voix", async () => {
    await expect(generateVoiceover(db, access, "alice", request(), provider, storage)).rejects.toMatchObject({ code: "consent_required" });
    expect(generateSpeech).not.toHaveBeenCalled();
  });

  it("crée une piste par diapositive, avec sa durée, et débite les crédits une seule fois", async () => {
    await acceptAiConsent(db, access, "alice", provider);
    access = (await getWorkspaceAccess(db, "alice", access.workspace._id.toHexString()))!;
    const input = request();
    const result = await generateVoiceover(db, access, "alice", input, provider, storage);
    expect(result.clips.map((clip) => clip.slide)).toEqual([0, 2]);
    expect(result.clips[1]?.seconds).toBeCloseTo(2.1, 1);
    expect(generateSpeech).toHaveBeenCalledWith(expect.objectContaining({ voice: "sage", instructions: expect.stringContaining("française") }));
    // Double clic : même résultat, aucun nouvel appel.
    expect((await generateVoiceover(db, access, "alice", input, provider, storage)).jobId).toBe(result.jobId);
    expect(generateSpeech).toHaveBeenCalledTimes(2);
    expect((await getCreditAccount(db, access.workspace)).used).toBe(CREDIT_COSTS.voiceover);

    const clip = await getVoiceoverClip(db, access, result.jobId, 2);
    expect(files.has(clip.storageKey)).toBe(true);
    expect(clip.storageKey.startsWith(`ws/${access.workspace._id.toHexString()}/voix/`)).toBe(true);
  });

  it("ne sert jamais la voix off d'un autre espace", async () => {
    const result = await generateVoiceover(db, access, "alice", request(), provider, storage);
    const other = await ensurePersonalWorkspace(db, { id: "bob", name: "Bob" });
    const bob = (await getWorkspaceAccess(db, "bob", other._id.toHexString()))!;
    await expect(getVoiceoverClip(db, bob, result.jobId, 0)).rejects.toMatchObject({ code: "not_found" });
    await expect(getVoiceoverClip(db, access, "pas-un-id", 0)).rejects.toMatchObject({ code: "not_found" });
  });

  it("en cas d'échec : rien ne reste dans le stockage et les crédits sont rendus", async () => {
    const before = (await getCreditAccount(db, access.workspace)).used;
    const stored = files.size;
    generateSpeech.mockResolvedValueOnce({ output: wav(1), model: "test", usage: { inputTokens: 1, outputTokens: 0 } });
    generateSpeech.mockRejectedValueOnce(new TextGenerationError("Le service de voix est très sollicité.", true));
    await expect(generateVoiceover(db, access, "alice", request(), provider, storage)).rejects.toMatchObject({ message: expect.stringContaining("sollicité") });
    expect(files.size).toBe(stored);
    expect((await getCreditAccount(db, access.workspace)).used).toBe(before);
  });

  it("refuse deux textes pour la même diapositive", async () => {
    const lines = [{ slide: 1, text: "Un." }, { slide: 1, text: "Deux." }];
    await expect(generateVoiceover(db, access, "alice", request({ lines }), provider, storage)).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("efface les fichiers après le délai de conservation", async () => {
    expect(files.size).toBeGreaterThan(0);
    expect(await purgeOldVoiceovers(db, storage, new Date())).toBe(0);
    const purged = await purgeOldVoiceovers(db, storage, new Date(Date.now() + VOICEOVER_RETENTION_MS + 60_000));
    expect(purged).toBeGreaterThan(0);
    expect(files.size).toBe(0);
    expect(await collections(db).generationJobs.countDocuments({ kind: "voiceover", "result.clips.0": { $exists: true } })).toBe(0);
  });
});

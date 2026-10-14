/**
 * Médiathèque sur une vraie base MongoDB (TEST_MONGODB_URI, fourni en CI).
 * Le stockage objet est simulé en mémoire.
 */
import { MongoClient, type Db } from "mongodb";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { collections } from "@/server/db/collections";
import { runMigrations } from "@/server/db/migrations";
import type { MediaStorage } from "@/server/media/storage";
import { deleteUserData } from "@/server/services/account";
import { createBrand } from "@/server/services/brands";
import { createTemplateMedia, deleteMedia, registerUpload, setBrandLogo, uploadKeyFor } from "@/server/services/media";
import { createDraft, setPostMedia } from "@/server/services/posts";
import { ensurePersonalWorkspace, getWorkspaceAccess, type WorkspaceAccess } from "@/server/services/workspaces";

const uri = process.env.TEST_MONGODB_URI;

function memoryStorage() {
  const files = new Map<string, { body: Buffer; contentType: string }>();
  const storage: MediaStorage = {
    isConfigured: () => true,
    async put(key, body, contentType) {
      files.set(key, { body, contentType });
    },
    async read(key) {
      const file = files.get(key);
      if (!file) return null;
      return { stream: new Blob([new Uint8Array(file.body)]).stream(), contentType: file.contentType, size: file.body.length };
    },
    async readBuffer(key) {
      return files.get(key)?.body ?? null;
    },
    async stat(key) {
      const file = files.get(key);
      return file ? { size: file.body.length, contentType: file.contentType } : null;
    },
    async remove(keys) {
      for (const key of keys) files.delete(key);
    },
  };
  return { storage, files };
}

describe.skipIf(!uri)("médiathèque (MongoDB réel)", () => {
  let client: MongoClient;
  let db: Db;
  let alice: WorkspaceAccess;
  let bob: WorkspaceAccess;
  let brandId: string;
  const { storage, files } = memoryStorage();

  beforeAll(async () => {
    client = new MongoClient(uri as string);
    await client.connect();
    db = client.db(`smia_test_media_${Date.now()}`);
    await runMigrations(db, () => {});
    const a = await ensurePersonalWorkspace(db, { id: "alice", name: "Alice" });
    const b = await ensurePersonalWorkspace(db, { id: "bob", name: "Bob" });
    alice = (await getWorkspaceAccess(db, "alice", a._id.toHexString()))!;
    bob = (await getWorkspaceAccess(db, "bob", b._id.toHexString()))!;
    brandId = (await createBrand(db, alice, "alice", { name: "Café", brandColors: ["#264653"] }))._id.toHexString();
  });

  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  async function uploadPng(access: WorkspaceAccess, width = 800, height = 600) {
    const key = uploadKeyFor(access, "photo café.png");
    await storage.put(key, await sharp({ create: { width, height, channels: 3, background: "#e76f51" } }).png().toBuffer(), "image/png");
    return registerUpload(db, access, access.workspace.ownerUserId, storage, { storageKey: key, name: "photo café.png" });
  }

  it("enregistre une vraie image avec ses dimensions réelles", async () => {
    const media = await uploadPng(alice);
    expect(media.mimeType).toBe("image/png");
    expect([media.width, media.height]).toEqual([800, 600]);
    expect(media.storageKey.startsWith(`ws/${alice.workspace._id.toHexString()}/uploads/`)).toBe(true);
  });

  it("refuse un fichier placé dans l'espace d'un autre utilisateur", async () => {
    const key = uploadKeyFor(bob, "x.png");
    await storage.put(key, Buffer.from("x"), "image/png");
    await expect(registerUpload(db, alice, "alice", storage, { storageKey: key, name: "x.png" })).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("refuse et efface un faux fichier image", async () => {
    const key = uploadKeyFor(alice, "faux.png");
    await storage.put(key, Buffer.from("<script>alert(1)</script>"), "image/png");
    await expect(registerUpload(db, alice, "alice", storage, { storageKey: key, name: "faux.png" })).rejects.toMatchObject({
      code: "invalid_input",
    });
    expect(files.has(key)).toBe(false);
  });

  it("crée un visuel JPEG aux dimensions du format, avec photo et logo", async () => {
    const photo = await uploadPng(alice, 1600, 1200);
    const logo = await uploadPng(alice, 200, 200);
    await setBrandLogo(db, alice, brandId, logo._id.toHexString());

    const media = await createTemplateMedia(db, alice, "alice", storage, {
      brandId,
      templateId: "photo_bandeau",
      format: "portrait",
      title: "Nouvelle carte",
      backgroundMediaId: photo._id.toHexString(),
    });
    expect(media.mimeType).toBe("image/jpeg");
    expect([media.width, media.height]).toEqual([1080, 1350]);
    expect(files.has(media.storageKey)).toBe(true);
  });

  it("n'utilise pas la photo d'un autre espace dans un visuel", async () => {
    const bobPhoto = await uploadPng(bob);
    await expect(
      createTemplateMedia(db, alice, "alice", storage, {
        brandId,
        templateId: "photo_bandeau",
        format: "square",
        title: "Test",
        backgroundMediaId: bobPhoto._id.toHexString(),
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("joint des images à une publication selon les règles du réseau, puis les retire à la suppression", async () => {
    const a = await uploadPng(alice);
    const b = await uploadPng(alice);
    const bobImage = await uploadPng(bob);
    const insta = await createDraft(db, alice, "alice", { brandId, network: "instagram", text: "Carrousel" });
    const x = await createDraft(db, alice, "alice", { brandId, network: "x", text: "Une image" });

    await setPostMedia(db, alice, insta._id.toHexString(), [a._id.toHexString(), b._id.toHexString()]);
    await expect(setPostMedia(db, alice, x._id.toHexString(), [a._id.toHexString(), b._id.toHexString()])).rejects.toMatchObject({
      code: "invalid_input",
    });
    await expect(setPostMedia(db, alice, insta._id.toHexString(), [bobImage._id.toHexString()])).rejects.toMatchObject({
      code: "not_found",
    });

    await deleteMedia(db, alice, "alice", storage, a._id.toHexString());
    const updated = await collections(db).posts.findOne({ _id: insta._id });
    expect(updated?.mediaIds?.map(String)).toEqual([b._id.toHexString()]);
    expect(files.has(a.storageKey)).toBe(false);
  });

  it("efface tous les fichiers de l'utilisateur à la suppression du compte", async () => {
    const prefix = `ws/${alice.workspace._id.toHexString()}/`;
    expect([...files.keys()].some((key) => key.startsWith(prefix))).toBe(true);
    await deleteUserData("alice", db, storage);
    expect([...files.keys()].some((key) => key.startsWith(prefix))).toBe(false);
    expect([...files.keys()].some((key) => key.startsWith(`ws/${bob.workspace._id.toHexString()}/`))).toBe(true);
    expect(await collections(db).mediaAssets.countDocuments({ workspaceId: alice.workspace._id })).toBe(0);
  });
});

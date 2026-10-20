/**
 * Témoignages sur une vraie base MongoDB (TEST_MONGODB_URI, fourni en CI).
 */
import { MongoClient, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { collections } from "@/server/db/collections";
import { runMigrations } from "@/server/db/migrations";
import { deleteUserData } from "@/server/services/account";
import {
  deleteMyTestimonial,
  isAdminEmail,
  listPublicTestimonials,
  reviewTestimonial,
  saveTestimonial,
  shouldAskForTestimonial,
} from "@/server/services/testimonials";
import { ensurePersonalWorkspace, getWorkspaceAccess, type WorkspaceAccess } from "@/server/services/workspaces";

const uri = process.env.TEST_MONGODB_URI;

describe.skipIf(!uri)("témoignages (MongoDB réel)", () => {
  let client: MongoClient;
  let db: Db;
  const users: Record<string, WorkspaceAccess> = {};
  const input = (overrides: Record<string, unknown> = {}) => ({
    rating: 5,
    text: "Je publie enfin chaque semaine sans y penser, merci !",
    authorName: "Léa M.",
    authorRole: "coach sportive",
    city: "Nantes",
    publishConsent: true,
    ...overrides,
  });

  beforeAll(async () => {
    client = new MongoClient(uri as string);
    await client.connect();
    db = client.db(`smia_test_avis_${Date.now()}`);
    await runMigrations(db, () => {});
    for (const id of ["u1", "u2", "u3", "u4"]) {
      const workspace = await ensurePersonalWorkspace(db, { id, name: id });
      users[id] = (await getWorkspaceAccess(db, id, workspace._id.toHexString()))!;
    }
  });

  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  it("valide la saisie et garde un seul avis par utilisateur, remis en relecture à chaque modification", async () => {
    await expect(saveTestimonial(db, users.u1!, "u1", input({ text: "court" }))).rejects.toMatchObject({ code: "invalid_input" });
    const first = await saveTestimonial(db, users.u1!, "u1", input());
    await reviewTestimonial(db, "admin", first._id.toHexString(), "approved");
    const edited = await saveTestimonial(db, users.u1!, "u1", input({ text: "Avis modifié après quelques semaines d'usage." }));
    expect(edited._id.equals(first._id)).toBe(true);
    expect(edited.status).toBe("pending");
    expect(await collections(db).testimonials.countDocuments({ userId: "u1" })).toBe(1);
  });

  it("le site n'affiche rien avant 3 avis validés et publiables ; jamais sans accord", async () => {
    for (const id of ["u1", "u2", "u3"]) await saveTestimonial(db, users[id]!, id, input({ authorName: id }));
    const all = await collections(db).testimonials.find({}).toArray();
    for (const doc of all.slice(0, 2)) await reviewTestimonial(db, "admin", doc._id.toHexString(), "approved");
    expect(await listPublicTestimonials(db)).toEqual([]);

    // Validé mais sans accord de publication : ne compte pas.
    const noConsent = await saveTestimonial(db, users.u4!, "u4", input({ publishConsent: false }));
    await reviewTestimonial(db, "admin", noConsent._id.toHexString(), "approved");
    expect(await listPublicTestimonials(db)).toEqual([]);

    const third = all[2];
    if (third) await reviewTestimonial(db, "admin", third._id.toHexString(), "approved");
    const visible = await listPublicTestimonials(db);
    expect(visible).toHaveLength(3);
    expect(visible.every((item) => item.authorName !== "u4")).toBe(true);

    // Retiré par son auteur : disparaît aussitôt.
    await deleteMyTestimonial(db, "u2");
    expect(await listPublicTestimonials(db)).toEqual([]);
  });

  it("n'invite pas un nouvel utilisateur, invite après 14 jours, plus jamais une fois l'avis donné", async () => {
    const now = new Date("2030-01-20T00:00:00Z");
    expect(await shouldAskForTestimonial(db, users.u3!, "nouveau", new Date("2030-01-19T00:00:00Z"), now)).toBe(false);
    expect(await shouldAskForTestimonial(db, users.u3!, "ancien", new Date("2030-01-01T00:00:00Z"), now)).toBe(true);
    expect(await shouldAskForTestimonial(db, users.u1!, "u1", new Date("2030-01-01T00:00:00Z"), now)).toBe(false);
  });

  it("supprime l'avis avec le compte", async () => {
    await deleteUserData("u1", db, { isConfigured: () => false, put: async () => {}, read: async () => null, readBuffer: async () => null, stat: async () => null, remove: async () => {} });
    expect(await collections(db).testimonials.countDocuments({ userId: "u1" })).toBe(0);
  });

  it("reconnaît les administrateurs sans tenir compte de la casse ni des espaces", () => {
    expect(isAdminEmail("Moi@Exemple.fr", " autre@x.fr, moi@exemple.fr ")).toBe(true);
    expect(isAdminEmail("moi@exemple.fr", "")).toBe(false);
  });
});

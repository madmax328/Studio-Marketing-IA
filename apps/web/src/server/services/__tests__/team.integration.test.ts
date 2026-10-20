/**
 * Équipes, agences et validation des publications sur une vraie base MongoDB (TEST_MONGODB_URI, fourni en CI).
 */
import { MongoClient, ObjectId, type Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { collections } from "@/server/db/collections";
import { runMigrations } from "@/server/db/migrations";
import { chargeCredits, getCreditAccount, getEffectivePlan, listCreditTransactions } from "@/server/services/billing";
import { createBrand } from "@/server/services/brands";
import { createClientSpace, deleteClientSpace } from "@/server/services/client-spaces";
import { approvePost, createDraft, listPendingApprovals, rejectPost, setPostSchedule, updatePostText } from "@/server/services/posts";
import { acceptInvitation, changeMemberRole, describeInvitation, getTeam, inviteMember, removeMember, setApprovalRequired } from "@/server/services/team";
import { ensurePersonalWorkspace, getWorkspaceAccess, type WorkspaceAccess } from "@/server/services/workspaces";

const uri = process.env.TEST_MONGODB_URI;

describe.skipIf(!uri)("équipes et agences (MongoDB réel)", () => {
  let client: MongoClient;
  let db: Db;
  const ids = { owner: new ObjectId().toHexString(), editor: new ObjectId().toHexString(), client: new ObjectId().toHexString(), other: new ObjectId().toHexString() };
  let owner: WorkspaceAccess;
  const sent: { to: string; subject: string; text: string }[] = [];
  const deps = { sendEmail: vi.fn(async (message: { to: string; subject: string; text: string }) => void sent.push(message)), appUrl: "https://app.test", inviterName: "Alice" };
  const tokenOf = (to: string) => sent.filter((m) => m.to === to).at(-1)?.text.match(/\/invitation\/([A-Za-z0-9_-]+)/)?.[1] ?? "";
  const access = async (userId: string, workspaceId: ObjectId) => (await getWorkspaceAccess(db, userId, workspaceId.toHexString()))!;

  beforeAll(async () => {
    client = new MongoClient(uri as string);
    await client.connect();
    db = client.db(`smia_test_team_${Date.now()}`);
    await runMigrations(db, () => {});
    await db.collection("user").insertMany([
      { _id: new ObjectId(ids.owner), name: "Alice", email: "alice@test.fr", emailVerified: true },
      { _id: new ObjectId(ids.editor), name: "Bruno", email: "bruno@test.fr", emailVerified: true },
      { _id: new ObjectId(ids.client), name: "Chloé", email: "chloe@test.fr", emailVerified: true },
      { _id: new ObjectId(ids.other), name: "David", email: "david@test.fr", emailVerified: true },
    ]);
    const workspace = await ensurePersonalWorkspace(db, { id: ids.owner, name: "Alice" });
    // Offre Agence (abonnement actif), pour les limites d'équipe et les espaces clients.
    await collections(db).subscriptions.insertOne({
      _id: workspace._id,
      planId: "agency",
      status: "active",
      stripeCustomerId: "cus",
      stripeSubscriptionId: "sub",
      stripePriceId: "price",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      lastEventAt: null,
      updatedAt: new Date(),
    });
    owner = await access(ids.owner, workspace._id);
  });

  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  it("la migration ajoute les limites d'équipe aux offres", async () => {
    expect((await getEffectivePlan(db, owner.workspace)).limits).toMatchObject({ maxMembers: 15, maxClientSpaces: 20 });
    expect((await collections(db).plans.findOne({ _id: "free" }))?.limits).toMatchObject({ maxMembers: 1, maxClientSpaces: 0 });
  });

  it("invitation : lien par e-mail, jeton jamais stocké en clair, réservé à l'adresse invitée, à usage unique", async () => {
    await inviteMember(db, owner, ids.owner, { email: "Bruno@Test.fr", role: "editor" }, deps);
    const token = tokenOf("bruno@test.fr");
    expect(token.length).toBeGreaterThan(20);
    expect(JSON.stringify(await collections(db).workspaceInvitations.find().toArray())).not.toContain(token);
    expect(await describeInvitation(db, token)).toMatchObject({ email: "bruno@test.fr", role: "editor", inviterName: "Alice" });

    await expect(acceptInvitation(db, { id: ids.other, email: "david@test.fr", emailVerified: true }, token)).rejects.toMatchObject({ code: "forbidden" });
    const joined = await acceptInvitation(db, { id: ids.editor, email: "bruno@test.fr", emailVerified: true }, token);
    expect(joined.equals(owner.workspace._id)).toBe(true);
    await expect(acceptInvitation(db, { id: ids.editor, email: "bruno@test.fr", emailVerified: true }, token)).rejects.toMatchObject({ code: "not_found" });
    expect((await getTeam(db, owner)).members.map((member) => [member.email, member.role])).toEqual([
      ["alice@test.fr", "owner"],
      ["bruno@test.fr", "editor"],
    ]);
  });

  it("un rédacteur ne gère pas l'équipe ; le propriétaire ne peut pas être retiré", async () => {
    const editor = await access(ids.editor, owner.workspace._id);
    await expect(inviteMember(db, editor, ids.editor, { email: "x@test.fr", role: "viewer" }, deps)).rejects.toMatchObject({ code: "forbidden" });
    await expect(removeMember(db, editor, ids.editor, ids.owner)).rejects.toMatchObject({ code: "forbidden" });
    await expect(changeMemberRole(db, owner, ids.owner, ids.owner, "viewer")).rejects.toMatchObject({ code: "forbidden" });
  });

  it("limite de l'offre : membres et invitations en attente comptent", async () => {
    await collections(db).workspaces.updateOne({ _id: owner.workspace._id }, { $set: { limitOverrides: { maxMembers: 3 } } });
    owner = await access(ids.owner, owner.workspace._id);
    await inviteMember(db, owner, ids.owner, { email: "chloe@test.fr", role: "client" }, deps);
    await expect(inviteMember(db, owner, ids.owner, { email: "david@test.fr", role: "viewer" }, deps)).rejects.toMatchObject({ code: "limit_reached" });
    // Réinviter la même personne remplace son invitation (nouveau lien) sans compter deux fois.
    await inviteMember(db, owner, ids.owner, { email: "chloe@test.fr", role: "client" }, deps);
    await collections(db).workspaces.updateOne({ _id: owner.workspace._id }, { $unset: { limitOverrides: "" } });
    owner = await access(ids.owner, owner.workspace._id);
  });

  it("validation : la demande d'un rédacteur attend ; le client valide ; une modification renvoie en validation ; un refus revient en brouillon", async () => {
    await setApprovalRequired(db, owner, ids.owner, true);
    owner = await access(ids.owner, owner.workspace._id);
    await acceptInvitation(db, { id: ids.client, email: "chloe@test.fr", emailVerified: true }, tokenOf("chloe@test.fr"));
    const editor = await access(ids.editor, owner.workspace._id);
    const customer = await access(ids.client, owner.workspace._id);

    const brand = await createBrand(db, owner, ids.owner, { name: "Studio", industry: "Yoga" });
    const draft = await createDraft(db, editor, ids.editor, { brandId: brand._id.toHexString(), network: "facebook", text: "Cours d'essai jeudi" });
    const id = draft._id.toHexString();
    const when = { date: "2099-06-01", time: "10:00" };

    const requested = await setPostSchedule(db, editor, ids.editor, id, when, "schedule");
    expect(requested.status).toBe("pending_approval");
    expect(requested.approval?.requestedAt.getTime()).toBe(requested.updatedAt.getTime());
    expect((await listPendingApprovals(db, customer)).map((post) => post._id.toHexString())).toEqual([id]);
    // Le client ne modifie rien, il valide.
    await expect(updatePostText(db, customer, id, "Autre texte", ids.client)).rejects.toMatchObject({ code: "forbidden" });
    const seen = requested.updatedAt.toISOString();
    await expect(approvePost(db, editor, ids.editor, id, seen)).rejects.toMatchObject({ code: "forbidden" });
    // Une version que le client n'a pas vue ne peut pas être validée.
    await expect(approvePost(db, customer, ids.client, id, new Date(0).toISOString())).rejects.toMatchObject({ code: "conflict" });

    const approved = await approvePost(db, customer, ids.client, id, seen);
    expect(approved).toMatchObject({ status: "scheduled", approval: { decision: "approved", decidedByUserId: ids.client } });

    const edited = await updatePostText(db, editor, id, "Cours d'essai jeudi soir", ids.editor);
    expect(edited.status).toBe("pending_approval");

    const rejected = await rejectPost(db, customer, ids.client, id, "Ajoutez l'heure du cours", edited.updatedAt.toISOString());
    expect(rejected).toMatchObject({ status: "draft", approval: { decision: "rejected", comment: "Ajoutez l'heure du cours" } });

    // Le propriétaire programme directement, sans attendre.
    expect((await setPostSchedule(db, owner, ids.owner, id, when, "schedule")).status).toBe("scheduled");
  });

  it("espace client : rattaché à l'abonnement de l'agence, crédits partagés, journal séparé, isolé des autres membres", async () => {
    const space = await createClientSpace(db, owner, ids.owner, { name: "Boulangerie Martin" });
    expect(space.approvalRequired).toBe(true);
    const inSpace = await access(ids.owner, space._id);
    expect((await getEffectivePlan(db, inSpace.workspace)).planId).toBe("agency");

    await chargeCredits(db, inSpace.workspace, { operation: "text_generation", idempotencyKey: "job:client-1", generationJobId: null });
    expect((await getCreditAccount(db, owner.workspace)).used).toBe((await getCreditAccount(db, inSpace.workspace)).used);
    expect((await listCreditTransactions(db, inSpace)).map((t) => t.idempotencyKey)).toEqual(["job:client-1"]);

    // Le rédacteur de l'agence n'est pas membre de l'espace client.
    expect(await getWorkspaceAccess(db, ids.editor, space._id.toHexString())).toBeNull();
    // Pas d'espace client dans un espace client.
    await expect(createClientSpace(db, inSpace, ids.owner, { name: "Sous-client" })).rejects.toMatchObject({ code: "forbidden" });

    await expect(deleteClientSpace(db, ids.editor, space._id.toHexString(), { isConfigured: () => false } as never)).rejects.toMatchObject({ code: "not_found" });
    await deleteClientSpace(db, ids.owner, space._id.toHexString(), { isConfigured: () => false } as never);
    expect(await collections(db).workspaces.findOne({ _id: space._id })).toBeNull();
    expect(await collections(db).workspaceMembers.countDocuments({ workspaceId: space._id })).toBe(0);
  });

  it("offre gratuite : pas d'espace client", async () => {
    const free = await ensurePersonalWorkspace(db, { id: ids.other, name: "David" });
    const david = await access(ids.other, free._id);
    await expect(createClientSpace(db, david, ids.other, { name: "Client" })).rejects.toMatchObject({ code: "limit_reached" });
  });
});

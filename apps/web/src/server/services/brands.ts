import { ObjectId, type Db } from "mongodb";
import { brandInputSchema, roleHasPermission, type BrandInput } from "@smia/shared";
import { collections, type BrandDoc } from "@/server/db/collections";
import { recordAudit } from "@/server/services/audit";
import { UserFacingError } from "@/server/services/errors";
import type { WorkspaceAccess } from "@/server/services/workspaces";

/**
 * Accès aux marques. Chaque fonction reçoit un accès déjà vérifié
 * (WorkspaceAccess) et filtre systématiquement par workspaceId.
 */

export async function listBrands(db: Db, access: WorkspaceAccess, page = 1, pageSize = 20): Promise<BrandDoc[]> {
  assertPermission(access, "brand:read");
  return collections(db)
    .brands.find({ workspaceId: access.workspace._id })
    .sort({ createdAt: -1 })
    .skip((Math.max(1, page) - 1) * pageSize)
    .limit(Math.min(pageSize, 100))
    .toArray();
}

export async function getBrand(db: Db, access: WorkspaceAccess, brandId: string): Promise<BrandDoc> {
  assertPermission(access, "brand:read");
  const brand = ObjectId.isValid(brandId)
    ? await collections(db).brands.findOne({ _id: new ObjectId(brandId), workspaceId: access.workspace._id })
    : null;
  // Même message qu'une marque inexistante : on ne révèle pas l'existence d'une marque d'un autre espace.
  if (!brand) throw new UserFacingError("Marque introuvable.", "not_found");
  return brand;
}

export async function createBrand(db: Db, access: WorkspaceAccess, userId: string, input: unknown): Promise<BrandDoc> {
  assertPermission(access, "brand:write");
  const data = parseBrand(input);
  const { brands } = collections(db);

  const count = await brands.countDocuments({ workspaceId: access.workspace._id });
  if (count >= access.workspace.limits.maxBrands) {
    throw new UserFacingError(
      `Votre offre permet ${access.workspace.limits.maxBrands} marque(s). Passez à une offre supérieure pour en ajouter.`,
      "limit_reached",
    );
  }

  const now = new Date();
  const brand: BrandDoc = {
    ...data,
    _id: new ObjectId(),
    workspaceId: access.workspace._id,
    createdByUserId: userId,
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
  await brands.insertOne(brand);
  await recordAudit(db, {
    workspaceId: access.workspace._id,
    actorUserId: userId,
    action: "brand.created",
    targetId: brand._id.toHexString(),
  });
  return brand;
}

export async function updateBrand(
  db: Db,
  access: WorkspaceAccess,
  userId: string,
  brandId: string,
  input: unknown,
): Promise<BrandDoc> {
  assertPermission(access, "brand:write");
  const data = parseBrand(input);
  const existing = await getBrand(db, access, brandId);
  const updated = await collections(db).brands.findOneAndUpdate(
    { _id: existing._id, workspaceId: access.workspace._id },
    { $set: { ...data, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!updated) throw new UserFacingError("Marque introuvable.", "not_found");
  await recordAudit(db, {
    workspaceId: access.workspace._id,
    actorUserId: userId,
    action: "brand.updated",
    targetId: existing._id.toHexString(),
  });
  return updated;
}

function parseBrand(input: unknown): BrandInput {
  const parsed = brandInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new UserFacingError(parsed.error.issues[0]?.message ?? "Données invalides.", "invalid_input");
  }
  return parsed.data;
}

function assertPermission(access: WorkspaceAccess, permission: Parameters<typeof roleHasPermission>[1]) {
  if (!roleHasPermission(access.role, permission)) {
    throw new UserFacingError("Vous n'avez pas les droits nécessaires pour cette action.", "forbidden");
  }
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BRAND_FIELD_LABELS, missingRecommendedFields } from "@smia/shared";
import { BrandForm } from "@/components/brand/brand-form";
import { Alert } from "@/components/ui/card";
import { updateBrandAction } from "@/server/actions/brands";
import { getDb } from "@/server/db/client";
import { getBrand } from "@/server/services/brands";
import { UserFacingError } from "@/server/services/errors";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Ma marque" };

export default async function BrandPage({ params, searchParams }: PageProps<"/ma-marque/[brandId]">) {
  const { brandId } = await params;
  const { cree } = await searchParams;
  const access = await requireWorkspace();

  const brand = await getBrand(getDb(), access, brandId).catch((error: unknown) => {
    if (error instanceof UserFacingError && error.code === "not_found") notFound();
    throw error;
  });

  const { _id, workspaceId, createdByUserId, schemaVersion, createdAt, updatedAt, ...input } = brand;
  const missing = missingRecommendedFields(input);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{brand.name}</h1>
      {cree ? <Alert tone="success">Votre marque a été créée.</Alert> : null}
      {missing.length > 0 ? (
        <Alert>
          Pour de meilleures publications, complétez : {missing.map((field) => BRAND_FIELD_LABELS[field]).join(", ")}.
        </Alert>
      ) : null}
      <BrandForm action={updateBrandAction.bind(null, brandId)} initial={input} submitLabel="Enregistrer" />
    </div>
  );
}

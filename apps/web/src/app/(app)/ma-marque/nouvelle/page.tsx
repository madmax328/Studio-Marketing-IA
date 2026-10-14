import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { roleHasPermission } from "@smia/shared";
import { BrandForm } from "@/components/brand/brand-form";
import { createBrandAction } from "@/server/actions/brands";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Nouvelle marque" };

export default async function NewBrandPage() {
  const access = await requireWorkspace();
  if (!roleHasPermission(access.role, "brand:write")) redirect("/ma-marque");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Décrire ma marque</h1>
      <BrandForm action={createBrandAction} submitLabel="Créer la marque" />
    </div>
  );
}

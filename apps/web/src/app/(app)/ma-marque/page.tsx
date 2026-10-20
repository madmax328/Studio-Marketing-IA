import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_TONE_LABELS, missingRecommendedFields, roleHasPermission } from "@smia/shared";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDb } from "@/server/db/client";
import { getEffectivePlan } from "@/server/services/billing";
import { listBrands } from "@/server/services/brands";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Ma marque" };

export default async function BrandsPage() {
  const access = await requireWorkspace();
  const brands = await listBrands(getDb(), access);
  const { limits } = await getEffectivePlan(getDb(), access.workspace);
  const canCreate = roleHasPermission(access.role, "brand:write") && brands.length < limits.maxBrands;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em]">Ma marque</h1>
          <p className="text-sm text-muted">La mémoire de votre activité, utilisée pour chaque publication.</p>
          <p className="text-xs text-muted">
            {brands.length} / {limits.maxBrands} marque(s) avec votre offre.
          </p>
        </div>
        {canCreate ? (
          <Link href="/ma-marque/nouvelle" className={buttonStyles("primary")}>
            Nouvelle marque
          </Link>
        ) : null}
      </header>

      {brands.length === 0 ? (
        <Card className="space-y-3">
          <p className="text-sm text-muted">Vous n&apos;avez pas encore décrit votre marque.</p>
          {canCreate ? (
            <Link href="/ma-marque/nouvelle" className={buttonStyles("primary")}>
              Créer ma marque
            </Link>
          ) : null}
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {brands.map((brand) => {
            const missing = missingRecommendedFields(brand).length;
            return (
              <li key={brand._id.toHexString()}>
                <Link href={`/ma-marque/${brand._id.toHexString()}`} className="block">
                  <Card className="space-y-1 transition hover:border-primary">
                    <p className="font-semibold">{brand.name}</p>
                    <p className="text-sm text-muted">
                      {brand.industry || "Secteur non renseigné"} · Ton {BRAND_TONE_LABELS[brand.tone].toLowerCase()}
                    </p>
                    {missing > 0 ? (
                      <p className="text-xs text-danger">{missing} information(s) importante(s) à compléter</p>
                    ) : (
                      <p className="text-xs text-success">Profil complet</p>
                    )}
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

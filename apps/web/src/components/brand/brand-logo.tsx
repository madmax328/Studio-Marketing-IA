"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { setBrandLogoAction } from "@/server/actions/media";

export function BrandLogo({
  brandId,
  currentLogoId,
  images,
}: {
  brandId: string;
  currentLogoId: string | null;
  images: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentLogoId ?? images[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(mediaId: string | null) {
    setPending(true);
    setError(null);
    const result = await setBrandLogoAction(brandId, mediaId);
    setPending(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-3">
      {currentLogoId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/medias/${currentLogoId}/fichier`} alt="Logo actuel" className="h-20 w-auto rounded border border-border bg-white p-2" />
      ) : (
        <p className="text-sm text-muted">Aucun logo défini.</p>
      )}
      {images.length === 0 ? (
        <p className="text-sm text-muted">
          Ajoutez d&apos;abord votre logo dans la{" "}
          <Link href="/medias" className="text-primary hover:underline">
            médiathèque
          </Link>{" "}
          (PNG à fond transparent conseillé).
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="logo" className="sr-only">
            Image du logo
          </label>
          <select
            id="logo"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            {images.map((image) => (
              <option key={image.id} value={image.id}>
                {image.name}
              </option>
            ))}
          </select>
          <Button variant="secondary" disabled={pending || !selected} onClick={() => save(selected)}>
            Utiliser comme logo
          </Button>
          {currentLogoId ? (
            <Button variant="ghost" disabled={pending} onClick={() => save(null)}>
              Retirer le logo
            </Button>
          ) : null}
        </div>
      )}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}

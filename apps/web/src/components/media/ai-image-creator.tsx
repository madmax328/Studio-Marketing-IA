"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { IMAGE_FORMAT_IDS, IMAGE_FORMATS, IMAGE_STYLE_LABELS, IMAGE_STYLES, type ImageFormatId, type ImageStyle } from "@smia/shared";
import { Button } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/card";
import { generateAiImageAction } from "@/server/actions/media";

const control =
  "w-full rounded-xl border border-border bg-black/30 px-3.5 py-2.5 text-sm text-foreground transition hover:border-border-strong focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15";

/** Création d'une image par IA, ajoutée à la médiathèque (sans texte : il est ajouté par les modèles de visuels). */
export function AiImageCreator({ brands, credits, cost }: { brands: { id: string; name: string }[]; credits: number; cost: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState<ImageFormatId>("square");
  const [style, setStyle] = useState<ImageStyle>("photo");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Un identifiant par demande : un double clic ne crée (et ne facture) qu'une image.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Créer une image avec l&apos;IA</h2>
        <p className="text-xs text-muted">
          {cost} crédits par image · {credits} crédit(s) restant(s) ce mois-ci
        </p>
      </div>
      <p className="text-sm text-muted">
        Décrivez la scène. L&apos;image ne contiendra aucun texte : ajoutez ensuite votre titre et votre logo avec
        « Créer un visuel ».
      </p>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setDone(false);
          start(async () => {
            const result = await generateAiImageAction({ requestId, brandId, description, format, style });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setDone(true);
            setDescription("");
            setRequestId(crypto.randomUUID());
            router.refresh();
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {brands.length > 1 ? (
            <label className="space-y-1.5 text-sm font-medium">
              <span className="block">Marque</span>
              <select className={control} value={brandId} onChange={(event) => setBrandId(event.target.value)}>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="space-y-1.5 text-sm font-medium">
            <span className="block">Format</span>
            <select className={control} value={format} onChange={(event) => setFormat(event.target.value as ImageFormatId)}>
              {IMAGE_FORMAT_IDS.map((id) => (
                <option key={id} value={id}>
                  {IMAGE_FORMATS[id].label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            <span className="block">Style</span>
            <select className={control} value={style} onChange={(event) => setStyle(event.target.value as ImageStyle)}>
              {IMAGE_STYLES.map((id) => (
                <option key={id} value={id}>
                  {IMAGE_STYLE_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block space-y-1.5 text-sm font-medium">
          <span className="block">Description de l&apos;image</span>
          <textarea
            className={control}
            rows={3}
            required
            minLength={8}
            maxLength={800}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ex. un tapis de yoga près d'une fenêtre, lumière douce du matin, plantes vertes"
          />
        </label>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {done ? <Alert tone="success">Image ajoutée à la médiathèque, ci-dessous.</Alert> : null}
        <Button type="submit" disabled={pending || credits < cost || !brandId}>
          {pending ? "Création en cours (jusqu'à une minute)…" : "Créer l'image"}
        </Button>
        {credits < cost ? <p className="text-xs text-muted">Crédits insuffisants ce mois-ci.</p> : null}
      </form>
    </Card>
  );
}

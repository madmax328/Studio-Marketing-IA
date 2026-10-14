"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  IMAGE_FORMAT_IDS,
  IMAGE_FORMATS,
  TEMPLATE_IDS,
  TEMPLATE_LABELS,
  type ImageFormatId,
  type TemplateId,
} from "@smia/shared";
import { Button } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { createTemplateMediaAction } from "@/server/actions/media";

interface EditorBrand {
  id: string;
  name: string;
  colors: string[];
  hasLogo: boolean;
}

interface EditorPhoto {
  id: string;
  name: string;
}

export function VisualEditor({ brands, photos }: { brands: EditorBrand[]; photos: EditorPhoto[] }) {
  const router = useRouter();
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [templateId, setTemplateId] = useState<TemplateId>(photos.length > 0 ? "photo_bandeau" : "couleur_titre");
  const [format, setFormat] = useState<ImageFormatId>("square");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [photoId, setPhotoId] = useState(photos[0]?.id ?? "");
  const brand = brands.find((item) => item.id === brandId);
  const [color, setColor] = useState((brand?.colors[0] ?? "#4f46e5").toLowerCase());
  const [showLogo, setShowLogo] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const needsPhoto = TEMPLATE_LABELS[templateId].needsPhoto;
  const input = {
    brandId,
    templateId,
    format,
    title,
    subtitle,
    color,
    showLogo,
    backgroundMediaId: needsPhoto ? photoId || undefined : undefined,
  };

  async function preview() {
    setLoadingPreview(true);
    setPreviewError(null);
    const params = new URLSearchParams({
      brandId,
      templateId,
      format,
      title,
      subtitle,
      color,
      showLogo: String(showLogo),
      ...(input.backgroundMediaId ? { backgroundMediaId: input.backgroundMediaId } : {}),
    });
    const response = await fetch(`/api/medias/apercu?${params.toString()}`);
    setLoadingPreview(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setPreviewError(body?.error ?? "L'aperçu n'a pas pu être généré.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(await response.blob()));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const result = await createTemplateMediaAction(input);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/medias?cree=1");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="brandId" className="block text-sm font-medium">
            Marque
          </label>
          <select
            id="brandId"
            value={brandId}
            onChange={(event) => {
              setBrandId(event.target.value);
              const next = brands.find((item) => item.id === event.target.value);
              if (next?.colors[0]) setColor(next.colors[0].toLowerCase());
            }}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            {brands.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Gabarit</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {TEMPLATE_IDS.map((id) => (
              <label
                key={id}
                className={cn(
                  "cursor-pointer rounded-lg border p-3 text-sm",
                  templateId === id ? "border-primary ring-1 ring-primary" : "border-border",
                )}
              >
                <input
                  type="radio"
                  name="templateId"
                  className="sr-only"
                  checked={templateId === id}
                  onChange={() => setTemplateId(id)}
                />
                <span className="font-medium">{TEMPLATE_LABELS[id].label}</span>
                <span className="mt-1 block text-xs text-muted">{TEMPLATE_LABELS[id].description}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-1">
          <label htmlFor="format" className="block text-sm font-medium">
            Format
          </label>
          <select
            id="format"
            value={format}
            onChange={(event) => setFormat(event.target.value as ImageFormatId)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            {IMAGE_FORMAT_IDS.map((id) => (
              <option key={id} value={id}>
                {IMAGE_FORMATS[id].label}
              </option>
            ))}
          </select>
        </div>

        <TextField label="Titre" name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
        <TextField
          label="Sous-titre (facultatif)"
          name="subtitle"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          maxLength={200}
          hint="N'écrivez que des informations exactes : prix, dates et offres apparaîtront tels quels."
        />

        {needsPhoto ? (
          photos.length === 0 ? (
            <Alert>Ce gabarit utilise une photo : ajoutez-en d&apos;abord dans la médiathèque.</Alert>
          ) : (
            <div className="space-y-1">
              <label htmlFor="photo" className="block text-sm font-medium">
                Photo
              </label>
              <select
                id="photo"
                value={photoId}
                onChange={(event) => setPhotoId(event.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                {photos.map((photo) => (
                  <option key={photo.id} value={photo.id}>
                    {photo.name}
                  </option>
                ))}
              </select>
            </div>
          )
        ) : null}

        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label htmlFor="color" className="block text-sm font-medium">
              Couleur
            </label>
            <div className="flex items-center gap-2">
              <input id="color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 rounded border border-border" />
              {(brand?.colors ?? []).map((brandColor) => (
                <button
                  key={brandColor}
                  type="button"
                  title={brandColor}
                  aria-label={`Utiliser la couleur ${brandColor}`}
                  onClick={() => setColor(brandColor.toLowerCase())}
                  className="h-7 w-7 rounded-full border border-border"
                  style={{ background: brandColor }}
                />
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} />
            Afficher le logo
            {brand && !brand.hasLogo ? <span className="text-xs text-muted">(aucun logo défini)</span> : null}
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={preview} disabled={loadingPreview || !title.trim()}>
            {loadingPreview ? "Création de l'aperçu…" : "Voir l'aperçu"}
          </Button>
          <Button onClick={save} disabled={saving || !title.trim()}>
            {saving ? "Enregistrement…" : "Enregistrer dans la médiathèque"}
          </Button>
        </div>
        {error ? <Alert tone="error">{error}</Alert> : null}
      </Card>

      <Card className="flex items-center justify-center">
        {previewError ? (
          <Alert tone="error">{previewError}</Alert>
        ) : previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Aperçu du visuel" className="max-h-[70vh] w-auto rounded-lg shadow" />
        ) : (
          <p className="text-sm text-muted">Saisissez un titre puis cliquez sur « Voir l&apos;aperçu ».</p>
        )}
      </Card>
    </div>
  );
}

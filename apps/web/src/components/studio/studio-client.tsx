"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  BRAND_TONES,
  BRAND_TONE_LABELS,
  POST_KINDS,
  POST_KIND_LABELS,
  SOCIAL_NETWORK_IDS,
  SOCIAL_NETWORKS,
  type BrandTone,
  type PostKind,
  type SocialNetworkId,
} from "@smia/shared";
import { TextCounter } from "@/components/posts/text-counter";
import { Button } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/card";
import { SelectField, TextAreaField } from "@/components/ui/field";
import { generatePostsAction, saveDraftAction } from "@/server/actions/studio";
import type { GeneratedPostView, GenerationView } from "@/server/services/generation";

interface StudioBrand {
  id: string;
  name: string;
  tone: BrandTone;
}

interface GenerationParams {
  brandId: string;
  kind: PostKind;
  brief: string;
  tone: BrandTone;
  variantsPerNetwork: number;
}

interface PostCard extends GeneratedPostView {
  key: string;
  jobId: string;
}

export function StudioClient({
  brands,
  credits,
  costPerGeneration,
}: {
  brands: StudioBrand[];
  credits: number;
  costPerGeneration: number;
}) {
  const [networks, setNetworks] = useState<SocialNetworkId[]>(["facebook", "instagram"]);
  const [params, setParams] = useState<GenerationParams | null>(null);
  const [cards, setCards] = useState<PostCard[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [left, setLeft] = useState(credits);

  async function generate(next: GenerationParams, targetNetworks: SocialNetworkId[]): Promise<GenerationView | null> {
    setError(null);
    const result = await generatePostsAction({
      ...next,
      networks: targetNetworks,
      requestId: crypto.randomUUID(),
    });
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    setLeft((value) => Math.max(0, value - costPerGeneration));
    return result.data;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (networks.length === 0) {
      setError("Choisissez au moins un réseau.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const next: GenerationParams = {
      brandId: String(form.get("brandId")),
      kind: String(form.get("kind")) as PostKind,
      brief: String(form.get("brief")),
      tone: String(form.get("tone")) as BrandTone,
      variantsPerNetwork: Number(form.get("variants")),
    };
    setPending(true);
    const view = await generate(next, networks);
    setPending(false);
    if (!view) return;
    setParams(next);
    setMissing(view.missingInformation);
    setCards(toCards(view));
  }

  async function regenerate(card: PostCard) {
    if (!params) return;
    setPending(true);
    const view = await generate({ ...params, variantsPerNetwork: 1 }, [card.network]);
    setPending(false);
    const replacement = view ? toCards(view)[0] : undefined;
    if (!replacement) return;
    setCards((current) => current.map((item) => (item.key === card.key ? replacement : item)));
  }

  const defaultBrand = brands[0];

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <Card className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Marque"
              name="brandId"
              defaultValue={defaultBrand?.id}
              options={brands.map((brand) => ({ value: brand.id, label: brand.name }))}
            />
            <SelectField
              label="Type de publication"
              name="kind"
              defaultValue="libre"
              options={POST_KINDS.map((kind) => ({ value: kind, label: POST_KIND_LABELS[kind] }))}
            />
          </div>

          <TextAreaField
            label="Que voulez-vous dire ?"
            name="brief"
            rows={4}
            required
            minLength={5}
            maxLength={2000}
            placeholder="Ex. : notre nouveau menu d'automne arrive le 15 octobre, avec une soupe de potiron maison et un dessert aux châtaignes."
            hint="Donnez les détails concrets (dates, prix, nouveautés) : l'IA n'inventera rien qui ne soit écrit ici ou dans votre marque."
          />

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Réseaux</legend>
            <div className="flex flex-wrap gap-2">
              {SOCIAL_NETWORK_IDS.map((id) => {
                const checked = networks.includes(id);
                return (
                  <label
                    key={id}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${checked ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() =>
                        setNetworks((current) =>
                          checked ? current.filter((item) => item !== id) : [...current, id],
                        )
                      }
                    />
                    {SOCIAL_NETWORKS[id].label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Ton"
              name="tone"
              defaultValue={defaultBrand?.tone ?? "chaleureux"}
              options={BRAND_TONES.map((tone) => ({ value: tone, label: BRAND_TONE_LABELS[tone] }))}
            />
            <SelectField
              label="Versions par réseau"
              name="variants"
              defaultValue="1"
              options={[1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              Crédits restants ce mois-ci : {left} · une génération = {costPerGeneration} crédit{costPerGeneration > 1 ? "s" : ""}
            </p>
            <Button type="submit" disabled={pending || left < costPerGeneration}>
              {pending ? "L'IA rédige… (jusqu'à une minute)" : "Générer les publications"}
            </Button>
          </div>
        </Card>
      </form>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {missing.length > 0 ? (
        <Alert>
          <p className="font-medium">Informations manquantes, que l&apos;IA n&apos;a pas inventées :</p>
          <ul className="mt-1 list-disc pl-5">
            {missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Link href="/ma-marque" className="mt-2 inline-block text-primary hover:underline">
            Compléter ma marque
          </Link>
        </Alert>
      ) : null}

      {cards.length > 0 && params ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {cards.map((card) => (
            <GeneratedPostEditor
              key={card.key}
              card={card}
              brandId={params.brandId}
              busy={pending}
              onRegenerate={() => regenerate(card)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function toCards(view: GenerationView): PostCard[] {
  return view.posts.map((post, index) => ({ ...post, key: `${view.jobId}-${index}`, jobId: view.jobId }));
}

function GeneratedPostEditor({
  card,
  brandId,
  busy,
  onRegenerate,
}: {
  card: PostCard;
  brandId: string;
  busy: boolean;
  onRegenerate: () => void;
}) {
  const [text, setText] = useState(card.composedText);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const textId = `post-${card.key}`;

  async function save() {
    setSaving(true);
    setError(null);
    const result = await saveDraftAction({
      brandId,
      network: card.network,
      text,
      rationale: card.rationale,
      generationJobId: card.jobId,
    });
    setSaving(false);
    if (result.ok) setSavedId(result.data.postId);
    else setError(result.error);
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{SOCIAL_NETWORKS[card.network].label}</h3>
        {!SOCIAL_NETWORKS[card.network].allowsTextOnly ? (
          <span className="text-xs text-muted">Image ou vidéo requise pour publier</span>
        ) : null}
      </div>
      <p className="text-sm text-muted">{card.rationale}</p>
      <label htmlFor={textId} className="sr-only">
        Texte de la publication {SOCIAL_NETWORKS[card.network].label}
      </label>
      <textarea
        id={textId}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setSavedId(null);
        }}
        rows={10}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary"
      />
      <TextCounter network={card.network} length={text.length} />
      {card.warnings.map((warning) => (
        <Alert key={warning} tone="error">
          {warning}
        </Alert>
      ))}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {savedId ? (
        <Alert tone="success">
          Enregistré en brouillon.{" "}
          <Link href={`/publications/${savedId}`} className="underline">
            Ouvrir
          </Link>
        </Alert>
      ) : null}
      <div className="mt-auto flex flex-wrap gap-2">
        <Button onClick={save} disabled={saving || savedId !== null || text.trim() === ""}>
          {saving ? "Enregistrement…" : "Enregistrer en brouillon"}
        </Button>
        <Button variant="secondary" onClick={onRegenerate} disabled={busy}>
          Régénérer
        </Button>
      </div>
    </Card>
  );
}

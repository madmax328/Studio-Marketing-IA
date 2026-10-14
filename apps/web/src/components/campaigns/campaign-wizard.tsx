"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  CAMPAIGN_OBJECTIVE_LABELS,
  CAMPAIGN_OBJECTIVES,
  SOCIAL_NETWORK_IDS,
  SOCIAL_NETWORKS,
  type CampaignObjective,
  type SocialNetworkId,
} from "@smia/shared";
import { Button } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/card";
import { TextAreaField, TextField } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { createCampaignAction } from "@/server/actions/campaigns";

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">
        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </Card>
  );
}

export function CampaignWizard({ brands, today }: { brands: { id: string; name: string }[]; today: string }) {
  const router = useRouter();
  const [objective, setObjective] = useState<CampaignObjective>("notoriete");
  const [networks, setNetworks] = useState<SocialNetworkId[]>(["facebook", "instagram"]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await createCampaignAction({
      brandId: String(form.get("brandId")),
      name: String(form.get("name")),
      objective,
      networks,
      highlights: String(form.get("highlights") ?? ""),
      startDate: String(form.get("startDate")),
      endDate: String(form.get("endDate")),
      postsPerWeek: Number(form.get("postsPerWeek")),
      defaultTime: String(form.get("defaultTime")),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/campagnes/${result.data.campaignId}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Step number={1} title="La marque et le nom de la campagne">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="brandId" className="block text-sm font-medium">
              Marque
            </label>
            <select id="brandId" name="brandId" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>
          <TextField label="Nom de la campagne" name="name" required maxLength={120} placeholder="Ex. Menu d'automne" />
        </div>
      </Step>

      <Step number={2} title="L'objectif">
        <div className="grid gap-2 sm:grid-cols-2">
          {CAMPAIGN_OBJECTIVES.map((id) => (
            <label
              key={id}
              className={cn(
                "cursor-pointer rounded-lg border px-3 py-2 text-sm",
                objective === id ? "border-primary ring-1 ring-primary" : "border-border",
              )}
            >
              <input type="radio" name="objective" className="sr-only" checked={objective === id} onChange={() => setObjective(id)} />
              {CAMPAIGN_OBJECTIVE_LABELS[id]}
            </label>
          ))}
        </div>
      </Step>

      <Step number={3} title="Les réseaux">
        <div className="flex flex-wrap gap-2">
          {SOCIAL_NETWORK_IDS.map((id) => {
            const checked = networks.includes(id);
            return (
              <label
                key={id}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1 text-sm",
                  checked ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => setNetworks((current) => (checked ? current.filter((item) => item !== id) : [...current, id]))}
                />
                {SOCIAL_NETWORKS[id].label}
              </label>
            );
          })}
        </div>
      </Step>

      <Step number={4} title="Ce qu'il faut mettre en avant">
        <TextAreaField
          label="Offres, événements, nouveautés, informations importantes"
          name="highlights"
          rows={4}
          maxLength={3000}
          placeholder="Ex. : nouvelle carte d'automne à partir du 15 octobre ; soirée dégustation le 31 octobre à 19 h, sur réservation."
          hint="Soyez précis : l'IA ne mentionnera que ce qui est écrit ici ou dans votre marque."
        />
      </Step>

      <Step number={5} title="La durée">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Début" name="startDate" type="date" required defaultValue={today} min={today} />
          <TextField label="Fin" name="endDate" type="date" required hint="92 jours maximum." min={today} />
        </div>
      </Step>

      <Step number={6} title="La fréquence">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="postsPerWeek" className="block text-sm font-medium">
              Publications par semaine (sur chaque réseau)
            </label>
            <select id="postsPerWeek" name="postsPerWeek" defaultValue="3" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              {[1, 2, 3, 4, 5, 7].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <TextField label="Heure de publication habituelle" name="defaultTime" type="time" defaultValue="12:00" required />
        </div>
      </Step>

      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || networks.length === 0}>
          {pending ? "Création…" : "Créer la campagne"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { BRAND_TONES, BRAND_TONE_LABELS, type BrandInput } from "@smia/shared";
import { Button } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/card";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import type { BrandFormState } from "@/server/actions/brands";

interface BrandFormProps {
  action: (state: BrandFormState, form: FormData) => Promise<BrandFormState>;
  initial?: BrandInput;
  submitLabel: string;
}

const join = (items: readonly string[] | undefined) => (items ?? []).join(", ");

export function BrandForm({ action, initial, submitLabel }: BrandFormProps) {
  const [state, formAction, pending] = useActionState(action, { error: null, saved: false });

  return (
    <form action={formAction} className="space-y-6">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.saved ? <Alert tone="success">Modifications enregistrées.</Alert> : null}

      <Card className="space-y-4">
        <h2 className="font-semibold">Votre activité</h2>
        <TextField label="Nom *" hint="Votre entreprise, votre marque, votre association, ou simplement votre nom." name="name" required maxLength={120} defaultValue={initial?.name} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Secteur d'activité" name="industry" placeholder="Ex. coaching, association sportive, photographie, restaurant" defaultValue={initial?.industry} />
          <TextField label="Site internet" name="website" type="url" placeholder="https://" defaultValue={initial?.website} />
        </div>
        <TextAreaField
          label="Description de l'activité"
          name="description"
          rows={4}
          maxLength={2000}
          hint="Ce que vous faites, votre histoire, ce qui vous rend unique."
          defaultValue={initial?.description}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Pays" name="country" defaultValue={initial?.country ?? "France"} />
          <TextField label="Fuseau horaire" name="timeZone" defaultValue={initial?.timeZone ?? "Europe/Paris"} hint="Ex. Europe/Paris" />
          <TextField label="Zone géographique" name="geographicArea" placeholder="Ex. Lyon et alentours" defaultValue={initial?.geographicArea} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Langue principale" name="primaryLanguage" defaultValue={initial?.primaryLanguage ?? "fr"} hint="Code langue : fr, en, es…" />
          <TextField label="Langues secondaires" name="secondaryLanguages" defaultValue={join(initial?.secondaryLanguages)} hint="Séparées par des virgules." />
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Ce que vous proposez et à qui</h2>
        <p className="text-sm text-muted">
          L&apos;IA n&apos;utilisera que ces informations : elle n&apos;inventera jamais de prix, de promotion ni de
          caractéristique.
        </p>
        <TextAreaField label="Public cible" name="targetAudience" defaultValue={initial?.targetAudience} />
        <TextAreaField label="Produits, services ou contenus" name="productsAndServices" rows={4} defaultValue={initial?.productsAndServices} />
        <TextAreaField label="Prix et offres" hint="Laissez vide si cela ne vous concerne pas." name="pricesAndOffers" defaultValue={initial?.pricesAndOffers} />
        <TextAreaField label="Promotions en cours" name="currentPromotions" defaultValue={initial?.currentPromotions} />
        <TextAreaField label="Ce qui vous distingue" name="competitiveAdvantages" defaultValue={initial?.competitiveAdvantages} />
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Ton et style</h2>
        <SelectField
          label="Ton de communication"
          name="tone"
          defaultValue={initial?.tone ?? "chaleureux"}
          options={BRAND_TONES.map((tone) => ({ value: tone, label: BRAND_TONE_LABELS[tone] }))}
        />
        <TextAreaField label="Style rédactionnel" name="writingStyle" placeholder="Ex. phrases courtes, tutoiement, émojis avec modération" defaultValue={initial?.writingStyle} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Mots à utiliser" name="wordsToUse" defaultValue={join(initial?.wordsToUse)} hint="Séparés par des virgules." />
          <TextField label="Mots à éviter" name="wordsToAvoid" defaultValue={join(initial?.wordsToAvoid)} hint="Séparés par des virgules." />
        </div>
        <TextField label="Appel à l'action préféré" name="preferredCallToAction" placeholder="Ex. Réservez au 04 00 00 00 00" defaultValue={initial?.preferredCallToAction} />
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Identité visuelle</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Couleurs de marque" name="brandColors" placeholder="#4F46E5, #F59E0B" defaultValue={join(initial?.brandColors)} hint="Format #RRGGBB, séparées par des virgules." />
          <TextField label="Polices autorisées" name="allowedFonts" defaultValue={join(initial?.allowedFonts)} hint="Séparées par des virgules." />
        </div>
        <p className="text-xs text-muted">Le logo se choisit dans la section « Logo » de cette page, depuis la médiathèque.</p>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Coordonnées publiques</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Téléphone" name="contactPhone" type="tel" defaultValue={initial?.publicContact.phone} />
          <TextField label="E-mail" name="contactEmail" type="email" defaultValue={initial?.publicContact.email} />
        </div>
        <TextField label="Adresse" name="contactAddress" defaultValue={initial?.publicContact.address} />
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { TextAreaField, TextField } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { deleteTestimonialAction, saveTestimonialAction } from "@/server/actions/testimonials";

interface Initial {
  rating: number;
  text: string;
  authorName: string;
  authorRole: string;
  city: string;
  publishConsent: boolean;
}

/** Formulaire d'avis : note, texte, nom et activité affichés, accord de publication. */
export function TestimonialForm({ initial, defaultName }: { initial: Initial | null; defaultName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setError(null);
        setSaved(false);
        start(async () => {
          const result = await saveTestimonialAction({
            rating,
            text: form.get("text"),
            authorName: form.get("authorName"),
            authorRole: form.get("authorRole"),
            city: form.get("city") ?? "",
            publishConsent: form.get("publishConsent") === "on",
          });
          if (!result.ok) setError(result.error);
          else {
            setSaved(true);
            router.refresh();
          }
        });
      }}
    >
      <fieldset>
        <legend className="text-sm font-medium">Votre note</legend>
        <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Note sur 5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} sur 5`}
              onClick={() => setRating(value)}
              className={cn("text-3xl leading-none transition", value <= rating ? "text-primary" : "text-white/15 hover:text-white/30")}
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>
      <TextAreaField
        label="Votre avis"
        name="text"
        rows={5}
        required
        minLength={20}
        maxLength={600}
        defaultValue={initial?.text}
        hint="Ce que le studio vous apporte, ce qui vous a plu ou déplu. Soyez franc : c'est ce qui rend un avis utile."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Nom affiché" name="authorName" required maxLength={60} defaultValue={initial?.authorName ?? defaultName} hint="Ex. « Léa M. »" />
        <TextField label="Votre activité" name="authorRole" required maxLength={80} defaultValue={initial?.authorRole} hint="Ex. « coach sportive »" />
        <TextField label="Ville (facultatif)" name="city" maxLength={60} defaultValue={initial?.city} />
      </div>
      <label className="flex items-start gap-2.5 text-sm text-muted">
        <input type="checkbox" name="publishConsent" defaultChecked={initial?.publishConsent ?? false} className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" />
        <span>
          J&apos;accepte que cet avis soit publié sur le site de Studio Marketing IA avec le nom, l&apos;activité et la ville
          indiqués. Je peux le retirer à tout moment.
        </span>
      </label>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {saved ? <Alert tone="success">Merci ! Votre avis est enregistré. Il sera relu avant toute publication.</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || rating === 0}>
          {pending ? "Enregistrement…" : initial ? "Mettre à jour mon avis" : "Envoyer mon avis"}
        </Button>
        {initial ? (
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Retirer votre avis ? Il disparaîtra aussitôt du site.")) return;
              start(async () => {
                const result = await deleteTestimonialAction();
                if (!result.ok) setError(result.error);
                router.refresh();
              });
            }}
          >
            Retirer mon avis
          </Button>
        ) : null}
      </div>
    </form>
  );
}

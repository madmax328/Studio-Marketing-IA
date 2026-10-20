"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { setPostMediaAction } from "@/server/actions/media";

/** Choix des médias d'une publication : des images (dans l'ordre de sélection) ou une seule vidéo. */
export function PostMediaPicker({
  postId,
  initial,
  images,
  editable,
  max,
}: {
  postId: string;
  initial: string[];
  images: { id: string; name: string; video?: boolean }[];
  editable: boolean;
  max: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(initial);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const changed = selected.join() !== initial.join();

  const isVideo = (id: string) => images.some((image) => image.id === id && image.video);

  function toggle(id: string) {
    setMessage(null);
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      // Une vidéo se publie seule ; choisir une image remplace une vidéo déjà choisie.
      if (isVideo(id)) return [id];
      const images = current.filter((item) => !isVideo(item));
      return images.length < max ? [...images, id] : images;
    });
  }

  async function save() {
    setPending(true);
    const result = await setPostMediaAction(postId, selected);
    setPending(false);
    setMessage(result.ok ? { tone: "success", text: "Médias enregistrés." } : { tone: "error", text: result.error });
    if (result.ok) router.refresh();
  }

  if (images.length === 0) {
    return (
      <p className="text-sm text-muted">
        Aucune image disponible.{" "}
        <Link href="/medias" className="text-primary hover:underline">
          Ajouter des images ou créer un visuel
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {images.map((image) => {
          const position = selected.indexOf(image.id);
          return (
            <li key={image.id}>
              <button
                type="button"
                disabled={!editable}
                onClick={() => toggle(image.id)}
                aria-pressed={position >= 0}
                title={image.name}
                className={cn(
                  "relative block w-full overflow-hidden rounded-lg border-2",
                  position >= 0 ? "border-primary" : "border-transparent",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/medias/${image.id}/fichier${image.video ? "?apercu=1" : ""}`}
                  alt={image.name}
                  loading="lazy"
                  className="aspect-square w-full bg-background object-cover"
                />
                {image.video ? (
                  <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-2 text-[10px] text-white">▶ Vidéo</span>
                ) : null}
                {position >= 0 ? (
                  <span className="absolute top-1 right-1 rounded-full bg-primary px-2 text-xs text-primary-foreground">{position + 1}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {editable ? (
        <Button variant="secondary" onClick={save} disabled={pending || !changed}>
          {pending ? "Enregistrement…" : "Enregistrer les images"}
        </Button>
      ) : null}
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
    </div>
  );
}

"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@smia/shared";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { prepareUploadAction, registerUploadAction } from "@/server/actions/media";

/** Envoi d'images : le fichier part directement vers le stockage, puis le serveur le vérifie. */
export function MediaUploader({ access }: { access: "private" | "public" }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(files: FileList) {
    setBusy(true);
    setError(null);
    let done = 0;
    for (const file of Array.from(files)) {
      if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
        setError(`${file.name} : seules les images JPEG, PNG ou WebP sont acceptées.`);
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setError(`${file.name} : fichier trop volumineux (15 Mo maximum).`);
        continue;
      }
      setStatus(`Envoi de ${file.name}…`);
      const prepared = await prepareUploadAction(file.name);
      if (!prepared.ok) {
        setError(prepared.error);
        break;
      }
      try {
        await upload(prepared.data.storageKey, file, {
          access,
          handleUploadUrl: "/api/medias/upload",
          contentType: file.type,
        });
      } catch {
        setError(`${file.name} : l'envoi a échoué. Réessayez.`);
        continue;
      }
      const registered = await registerUploadAction({ storageKey: prepared.data.storageKey, name: file.name });
      if (!registered.ok) setError(`${file.name} : ${registered.error}`);
      else done += 1;
    }
    setBusy(false);
    setStatus(done > 0 ? `${done} image(s) ajoutée(s).` : null);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        multiple
        className="sr-only"
        id="media-upload"
        onChange={(event) => event.target.files && event.target.files.length > 0 && send(event.target.files)}
      />
      <Button variant="secondary" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Envoi en cours…" : "Ajouter des images"}
      </Button>
      {status ? <p className="text-sm text-muted" role="status">{status}</p> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}

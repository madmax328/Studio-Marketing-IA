"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteMediaAction } from "@/server/actions/media";

export function DeleteMediaButton({ mediaId }: { mediaId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-xs text-danger hover:underline disabled:opacity-50"
      onClick={() => {
        if (!window.confirm("Supprimer cette image ? Elle sera retirée des publications qui l'utilisent.")) return;
        start(async () => {
          const result = await deleteMediaAction(mediaId);
          if (!result.ok) window.alert(result.error);
          router.refresh();
        });
      }}
    >
      {pending ? "Suppression…" : "Supprimer"}
    </button>
  );
}

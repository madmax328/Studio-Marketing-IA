"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { approvePostAction, rejectPostAction } from "@/server/actions/team";

/** Validation d'une publication en attente : la valider (elle part à sa date) ou la refuser avec une remarque. */
export function PostApprovalPanel({ postId }: { postId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState("");

  const run = (action: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>) =>
    start(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });

  return (
    <div className="space-y-3">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {rejecting ? (
        <div className="space-y-2">
          <label htmlFor="approval-comment" className="block text-sm font-medium">
            Ce qu&apos;il faut changer (facultatif, visible par l&apos;auteur)
          </label>
          <textarea
            id="approval-comment"
            rows={3}
            maxLength={500}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className="w-full rounded-xl border border-border bg-black/30 px-3.5 py-2.5 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" disabled={pending} onClick={() => run(() => rejectPostAction(postId, comment))}>
              {pending ? "Envoi…" : "Refuser"}
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setRejecting(false)}>
              Retour
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={() => run(() => approvePostAction(postId))}>
            {pending ? "Validation…" : "Valider et programmer"}
          </Button>
          <Button variant="secondary" disabled={pending} onClick={() => setRejecting(true)}>
            Demander des changements
          </Button>
        </div>
      )}
    </div>
  );
}

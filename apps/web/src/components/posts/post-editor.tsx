"use client";

import { useActionState, useState, useTransition } from "react";
import type { SocialNetworkId } from "@smia/shared";
import { TextCounter } from "@/components/posts/text-counter";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { deletePostAction, updatePostAction, type PostFormState } from "@/server/actions/posts";

export function PostEditor({
  postId,
  network,
  initialText,
  editable,
}: {
  postId: string;
  network: SocialNetworkId;
  initialText: string;
  editable: boolean;
}) {
  const [text, setText] = useState(initialText);
  const [state, formAction, pending] = useActionState<PostFormState, FormData>(
    updatePostAction.bind(null, postId),
    { error: null, saved: false },
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-3">
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        {state.saved ? <Alert tone="success">Modifications enregistrées.</Alert> : null}
        <label htmlFor="text" className="block text-sm font-medium">
          Texte de la publication
        </label>
        <textarea
          id="text"
          name="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          readOnly={!editable}
          rows={12}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary"
        />
        <TextCounter network={network} length={text.length} />
        {editable ? (
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        ) : null}
      </form>

      {editable ? (
        <div className="border-t border-border pt-3">
          {deleteError ? <Alert tone="error">{deleteError}</Alert> : null}
          <Button
            variant="danger"
            disabled={deleting}
            onClick={() => {
              if (!window.confirm("Supprimer définitivement cette publication ?")) return;
              startDelete(async () => {
                const result = await deletePostAction(postId);
                if (result?.error) setDeleteError(result.error);
              });
            }}
          >
            {deleting ? "Suppression…" : "Supprimer"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { acceptInvitationAction } from "@/server/actions/team";

export function AcceptInvitationButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await acceptInvitationAction(token);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push("/tableau-de-bord");
            router.refresh();
          })
        }
      >
        {pending ? "Un instant…" : "Rejoindre l'espace"}
      </Button>
    </div>
  );
}

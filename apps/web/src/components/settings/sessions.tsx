"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

export function RevokeOtherSessions() {
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-3">
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      <Button
        variant="secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const { error } = await authClient.revokeOtherSessions();
          setPending(false);
          setMessage(
            error
              ? { tone: "error", text: authErrorMessage(error) }
              : { tone: "success", text: "Toutes vos autres sessions ont été déconnectées." },
          );
        }}
      >
        Déconnecter mes autres appareils
      </Button>
    </div>
  );
}

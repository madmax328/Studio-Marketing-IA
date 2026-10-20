"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="ghost"
      className={compact ? "px-3 py-1.5" : "w-full justify-start"}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.push("/connexion");
        router.refresh();
      }}
    >
      {pending ? "Déconnexion…" : "Se déconnecter"}
    </Button>
  );
}

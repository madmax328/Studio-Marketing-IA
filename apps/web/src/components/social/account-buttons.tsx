"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { connectSimulationAction, disconnectAccountAction, markNotificationsReadAction } from "@/server/actions/social";

const linkButton = "text-sm text-primary hover:underline disabled:opacity-50";

export function ConnectSimulationButton({ network }: { network: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={linkButton}
      onClick={() =>
        start(async () => {
          const result = await connectSimulationAction(network);
          if (!result.ok) window.alert(result.error);
          router.refresh();
        })
      }
    >
      {pending ? "Connexion…" : "Connecter un compte de test (simulation)"}
    </button>
  );
}

export function DisconnectButton({ accountId, label }: { accountId: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-xs text-danger hover:underline disabled:opacity-50"
      onClick={() => {
        if (!window.confirm(`Déconnecter « ${label} » ? Les publications programmées sur ce réseau ne partiront plus.`)) return;
        start(async () => {
          const result = await disconnectAccountAction(accountId);
          if (!result.ok) window.alert(result.error);
          router.refresh();
        });
      }}
    >
      {pending ? "Déconnexion…" : "Déconnecter"}
    </button>
  );
}

export function MarkReadButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={linkButton}
      onClick={() =>
        start(async () => {
          await markNotificationsReadAction();
          router.refresh();
        })
      }
    >
      Tout marquer comme lu
    </button>
  );
}

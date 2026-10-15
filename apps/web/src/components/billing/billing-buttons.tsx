"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { openPortalAction, startCheckoutAction } from "@/server/actions/billing";

function useRedirect() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go(action: () => Promise<{ ok: true; data: { url: string } } | { ok: false; error: string }>) {
    setPending(true);
    setError(null);
    const result = await action();
    if (result.ok) {
      window.location.href = result.data.url;
      return;
    }
    setPending(false);
    setError(result.error);
  }
  return { pending, error, go };
}

export function CheckoutButton({ planId, label }: { planId: string; label: string }) {
  const { pending, error, go } = useRedirect();
  return (
    <div className="space-y-1">
      <Button className="w-full" disabled={pending} onClick={() => go(() => startCheckoutAction(planId))}>
        {pending ? "Ouverture du paiement…" : label}
      </Button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

export function PortalButton() {
  const { pending, error, go } = useRedirect();
  return (
    <div className="space-y-1">
      <Button variant="secondary" disabled={pending} onClick={() => go(() => openPortalAction())}>
        {pending ? "Ouverture…" : "Gérer mon abonnement"}
      </Button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

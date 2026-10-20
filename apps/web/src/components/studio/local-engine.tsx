"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { isDesktopApp, localAiStatus, pullLocalModel, RECOMMENDED_LOCAL_MODEL, type LocalAiStatus, type PullProgress } from "@/lib/desktop";

export interface LocalAiState {
  desktop: boolean;
  status: LocalAiStatus | null;
  refresh: () => void;
}

/** État de l'IA locale : seulement dans l'application de bureau. */
export function useLocalAi(): LocalAiState {
  const [desktop, setDesktop] = useState(false);
  const [status, setStatus] = useState<LocalAiStatus | null>(null);
  const refresh = useCallback(() => {
    localAiStatus()
      .then(setStatus)
      .catch(() => setStatus({ running: false, models: [] }));
  }, []);
  useEffect(() => {
    const inDesktop = isDesktopApp();
    setDesktop(inDesktop);
    if (inDesktop) refresh();
  }, [refresh]);
  return { desktop, status, refresh };
}

const gb = (bytes: number) => (bytes / 1e9).toLocaleString("fr-FR", { maximumFractionDigits: 1 });

/** Installation guidée : Ollama absent, ou aucun modèle téléchargé. */
export function LocalEngineSetup({ state }: { state: LocalAiState }) {
  const [progress, setProgress] = useState<PullProgress | null>(null);
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { status } = state;
  if (!status) return <p className="text-sm text-muted">Recherche de l&apos;IA locale sur cet ordinateur…</p>;

  if (!status.running) {
    return (
      <div className="space-y-2 text-sm">
        <p>
          Pour écrire sans crédits, installez <strong>Ollama</strong> (gratuit) depuis ollama.com, lancez-le, puis cliquez sur
          « Vérifier ». Votre ordinateur fera alors tourner l&apos;IA lui-même : vos textes ne partent chez aucun service d&apos;IA.
        </p>
        <Button variant="secondary" onClick={state.refresh}>
          Vérifier
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      <p>
        Ollama est prêt. Téléchargez le modèle conseillé (<span className="font-mono">{RECOMMENDED_LOCAL_MODEL}</span>, environ 4,7 Go,
        une seule fois). Comptez 8 Go de mémoire vive au minimum.
      </p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {pulling && progress ? (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${progress.total && progress.completed ? Math.round((progress.completed / progress.total) * 100) : 2}%` }}
            />
          </div>
          <p className="text-xs text-muted">
            {progress.total && progress.completed ? `${gb(progress.completed)} / ${gb(progress.total)} Go` : progress.status}
          </p>
        </div>
      ) : null}
      <Button
        variant="secondary"
        disabled={pulling}
        onClick={async () => {
          setPulling(true);
          setError(null);
          try {
            await pullLocalModel(RECOMMENDED_LOCAL_MODEL, setProgress);
            state.refresh();
          } catch (exception) {
            setError(typeof exception === "string" ? exception : "Le téléchargement a échoué. Vérifiez votre connexion et l'espace disque, puis réessayez.");
          } finally {
            setPulling(false);
          }
        }}
      >
        {pulling ? "Téléchargement…" : "Télécharger le modèle"}
      </Button>
    </div>
  );
}

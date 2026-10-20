"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AI_VIDEO_ORIENTATION_LABELS, AI_VIDEO_ORIENTATIONS, AI_VIDEO_SECONDS, type AiVideoOrientation, type AiVideoSeconds } from "@smia/shared";
import { Button } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/card";
import { pollAiVideoAction, startAiVideoAction } from "@/server/actions/media";

const control =
  "w-full rounded-xl border border-border bg-black/30 px-3.5 py-2.5 text-sm text-foreground transition hover:border-border-strong focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15";
const POLL_MS = 6_000;

/**
 * Création d'une courte vidéo par IA. Le service met quelques minutes : la page suit l'avancement, et si elle est
 * fermée, le planificateur termine le travail (la vidéo apparaît alors dans la médiathèque).
 */
export function AiVideoCreator({
  brands,
  credits,
  costs,
  pending: initialPending,
}: {
  brands: { id: string; name: string }[];
  credits: number;
  costs: Record<AiVideoSeconds, number>;
  pending: { jobId: string; description: string }[];
}) {
  const router = useRouter();
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [orientation, setOrientation] = useState<AiVideoOrientation>("vertical");
  const [seconds, setSeconds] = useState<AiVideoSeconds>(4);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [jobs, setJobs] = useState(initialPending.map((job) => ({ ...job, progress: null as number | null })));
  const [done, setDone] = useState(0);
  // Un identifiant par demande : un double clic ne crée (et ne facture) qu'une vidéo.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const cost = costs[seconds];

  const poll = useCallback(async () => {
    const current = jobsRef.current;
    for (const job of current) {
      const result = await pollAiVideoAction(job.jobId);
      if (!result.ok) continue;
      const state = result.data;
      if (state.status === "processing") {
        setJobs((list) => list.map((item) => (item.jobId === job.jobId ? { ...item, progress: state.progress } : item)));
      } else {
        setJobs((list) => list.filter((item) => item.jobId !== job.jobId));
        if (state.status === "done") {
          setDone((count) => count + 1);
          router.refresh();
        } else {
          setError(state.error);
        }
      }
    }
  }, [router]);
  const jobsRef = useRef(jobs);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);
  useEffect(() => {
    if (jobs.length === 0) return;
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(timer);
  }, [jobs.length, poll]);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Créer une vidéo avec l&apos;IA</h2>
        <p className="text-xs text-muted">
          {costs[4]} crédits (4 s) ou {costs[8]} crédits (8 s) · {credits} crédit(s) restant(s)
        </p>
      </div>
      <p className="text-sm text-muted">
        Décrivez une scène : l&apos;IA la filme pour vous, sans texte ni logo à l&apos;écran. La vidéo est vérifiée puis rangée
        dans la médiathèque. Comptez quelques minutes ; vous pouvez fermer la page.
      </p>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          setStarting(true);
          const result = await startAiVideoAction({ requestId, brandId, description, orientation, seconds });
          setStarting(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setJobs((list) => [{ jobId: result.data.jobId, description, progress: null }, ...list.filter((job) => job.jobId !== result.data.jobId)]);
          setDescription("");
          setRequestId(crypto.randomUUID());
          router.refresh();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {brands.length > 1 ? (
            <label className="space-y-1.5 text-sm font-medium">
              <span className="block">Marque</span>
              <select className={control} value={brandId} onChange={(event) => setBrandId(event.target.value)}>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="space-y-1.5 text-sm font-medium">
            <span className="block">Format</span>
            <select className={control} value={orientation} onChange={(event) => setOrientation(event.target.value as AiVideoOrientation)}>
              {AI_VIDEO_ORIENTATIONS.map((id) => (
                <option key={id} value={id}>
                  {AI_VIDEO_ORIENTATION_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            <span className="block">Durée</span>
            <select className={control} value={seconds} onChange={(event) => setSeconds(Number(event.target.value) as AiVideoSeconds)}>
              {AI_VIDEO_SECONDS.map((value) => (
                <option key={value} value={value}>
                  {value} secondes ({costs[value]} crédits)
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block space-y-1.5 text-sm font-medium">
          <span className="block">Description de la scène</span>
          <textarea
            className={control}
            rows={3}
            required
            minLength={15}
            maxLength={1000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ex. une tasse de café fumante posée sur une table en bois, au lever du soleil, la caméra s'approche lentement"
          />
        </label>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {done > 0 ? <Alert tone="success">Vidéo ajoutée à la médiathèque.</Alert> : null}
        {jobs.map((job) => (
          <div key={job.jobId} className="space-y-1">
            <p className="truncate text-xs text-muted">En cours : {job.description || "vidéo"}</p>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.max(4, job.progress ?? 4)}%` }} />
            </div>
          </div>
        ))}
        <Button type="submit" disabled={starting || credits < cost || !brandId}>
          {starting ? "Envoi de la demande…" : "Créer la vidéo"}
        </Button>
        {credits < cost ? <p className="text-xs text-muted">Crédits insuffisants ce mois-ci.</p> : null}
        <p className="text-xs text-muted">
          Vidéo générée par IA : elle est signalée comme telle sur TikTok et YouTube lors de la publication ; mentionnez-le aussi
          sur les autres réseaux.
        </p>
      </form>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  POST_KIND_LABELS,
  POST_KINDS,
  POST_STATUS_LABELS,
  SOCIAL_NETWORKS,
  type CampaignStatus,
  type CampaignStrategy,
  type PostKind,
  type PostStatus,
  type SocialNetworkId,
} from "@smia/shared";
import { Button } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/card";
import {
  archiveCampaignAction,
  generateCampaignBatchAction,
  proposeStrategyAction,
  regenerateCampaignPostAction,
  saveStrategyAction,
  scheduleCampaignAction,
} from "@/server/actions/campaigns";

export interface WorkspacePost {
  id: string;
  slotId: string | null;
  network: SocialNetworkId;
  status: PostStatus;
  excerpt: string;
  localDate: string | null;
  localTime: string | null;
  problems: string[];
}

interface Props {
  campaign: {
    id: string;
    status: CampaignStatus;
    strategy: CampaignStrategy | null;
    missingInformation: string[];
    networks: SocialNetworkId[];
    startDate: string;
    endDate: string;
    defaultTime: string;
  };
  posts: WorkspacePost[];
  pendingSlots: number;
  batchSize: number;
  aiReady: boolean;
  canWrite: boolean;
  canPublish: boolean;
}

const inputClass = "w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm";

export function CampaignWorkspace({ campaign, posts, pendingSlots, batchSize, aiReady, canWrite, canPublish }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(campaign.status !== "validated");
  const [strategy, setStrategy] = useState<CampaignStrategy | null>(campaign.strategy);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<{ postId: string; reason: string }[]>([]);

  const archived = campaign.status === "archived";

  async function propose() {
    setBusy("propose");
    setMessage(null);
    const result = await proposeStrategyAction(campaign.id, crypto.randomUUID());
    setBusy(null);
    if (!result.ok) setMessage({ tone: "error", text: result.error });
    else {
      setMessage({ tone: "success", text: "Stratégie proposée : relisez-la et modifiez-la si besoin." });
      router.refresh();
      setStrategy(null);
      setEditing(true);
    }
  }

  async function save(validate: boolean) {
    if (!strategy) return;
    setBusy(validate ? "validate" : "save");
    setMessage(null);
    const result = await saveStrategyAction(campaign.id, strategy, validate);
    setBusy(null);
    if (!result.ok) {
      setMessage({ tone: "error", text: result.error });
      return;
    }
    setMessage({ tone: "success", text: validate ? "Stratégie validée." : "Modifications enregistrées." });
    if (validate) setEditing(false);
    router.refresh();
  }

  async function generateAll() {
    setBusy("generate");
    setMessage(null);
    let remaining = pendingSlots;
    let created = 0;
    const missing = new Set<string>();
    while (remaining > 0) {
      setProgress(`Rédaction en cours… ${pendingSlots - remaining} / ${pendingSlots} créneaux`);
      const result = await generateCampaignBatchAction(campaign.id, crypto.randomUUID());
      if (!result.ok) {
        setMessage({ tone: "error", text: `${result.error} ${created} publication(s) déjà créée(s) : relancez pour continuer.` });
        break;
      }
      created += result.data.created;
      result.data.missingInformation.forEach((item) => missing.add(item));
      // Sécurité : si un lot ne progresse pas, on s'arrête au lieu de boucler.
      if (result.data.remaining >= remaining) {
        setMessage({ tone: "error", text: "Certains créneaux n'ont pas pu être rédigés. Relancez la génération." });
        break;
      }
      remaining = result.data.remaining;
    }
    setProgress(null);
    setBusy(null);
    if (remaining === 0) {
      setMessage({
        tone: "success",
        text: `${created} publication(s) créée(s) en brouillon.${missing.size > 0 ? ` Informations manquantes signalées : ${[...missing].join(" ; ")}` : ""}`,
      });
    }
    router.refresh();
  }

  async function scheduleAll() {
    setBusy("schedule");
    setMessage(null);
    const result = await scheduleCampaignAction(campaign.id);
    setBusy(null);
    if (!result.ok) {
      setMessage({ tone: "error", text: result.error });
      return;
    }
    setSkipped(result.data.skipped);
    setMessage({
      tone: result.data.scheduled > 0 ? "success" : "info",
      text: `${result.data.scheduled} publication(s) programmée(s).${result.data.skipped.length > 0 ? ` ${result.data.skipped.length} à compléter (voir ci-dessous).` : ""}`,
    });
    router.refresh();
  }

  async function regenerate(postId: string) {
    setBusy(`regen-${postId}`);
    const result = await regenerateCampaignPostAction(postId, crypto.randomUUID());
    setBusy(null);
    setMessage(result.ok ? { tone: "success", text: "Nouvelle version rédigée." } : { tone: "error", text: result.error });
    router.refresh();
  }

  async function archive() {
    if (!window.confirm("Archiver cette campagne ? Ses publications restent dans le calendrier.")) return;
    const result = await archiveCampaignAction(campaign.id);
    if (!result.ok) setMessage({ tone: "error", text: result.error });
    router.refresh();
  }

  const current = strategy ?? campaign.strategy;
  const updateSlot = (slotId: string, patch: Partial<CampaignStrategy["slots"][number]>) =>
    setStrategy((s) => {
      const base = s ?? campaign.strategy;
      return base ? { ...base, slots: base.slots.map((slot) => (slot.slotId === slotId ? { ...slot, ...patch } : slot)) } : base;
    });

  return (
    <div className="space-y-6">
      {message ? <Alert tone={message.tone === "info" ? "info" : message.tone}>{message.text}</Alert> : null}
      {progress ? <Alert>{progress}</Alert> : null}

      {campaign.missingInformation.length > 0 ? (
        <Alert>
          <p className="font-medium">Informations manquantes, que l&apos;IA n&apos;a pas inventées :</p>
          <ul className="mt-1 list-disc pl-5">
            {campaign.missingInformation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {!current ? (
        <Card className="space-y-3">
          <h2 className="font-semibold">Étape 7 : proposition de stratégie</h2>
          <p className="text-sm text-muted">
            L&apos;IA répartit les publications sur la période et propose un sujet et un rôle pour chacune. Vous pourrez tout
            modifier avant de valider.
          </p>
          {!aiReady ? (
            <Alert>
              La génération par IA doit d&apos;abord être activée et acceptée dans le{" "}
              <Link href="/studio" className="underline">
                studio de contenu
              </Link>
              .
            </Alert>
          ) : canWrite && !archived ? (
            <Button onClick={propose} disabled={busy !== null}>
              {busy === "propose" ? "L'IA prépare la stratégie… (jusqu'à une minute)" : "Proposer une stratégie"}
            </Button>
          ) : null}
        </Card>
      ) : (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Étape 8 : la stratégie</h2>
            {!editing && canWrite && !archived ? (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Modifier la stratégie
              </Button>
            ) : null}
          </div>

          {editing ? (
            <>
              <div className="space-y-1">
                <label htmlFor="summary" className="block text-sm font-medium">
                  Résumé
                </label>
                <textarea
                  id="summary"
                  rows={4}
                  className={inputClass}
                  value={current.summary}
                  onChange={(e) => setStrategy({ ...current, summary: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="keyMessages" className="block text-sm font-medium">
                  Messages clés (un par ligne)
                </label>
                <textarea
                  id="keyMessages"
                  rows={3}
                  className={inputClass}
                  value={current.keyMessages.join("\n")}
                  onChange={(e) => setStrategy({ ...current, keyMessages: e.target.value.split("\n").filter((l) => l.trim()) })}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Plan de publication (chaque ligne = une publication sur chaque réseau)</p>
                {current.slots.map((slot, index) => (
                  <div key={slot.slotId} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[8.5rem_6rem_1fr_11rem_auto]">
                    <input
                      type="date"
                      aria-label={`Date de la publication ${index + 1}`}
                      className={inputClass}
                      value={slot.date}
                      min={campaign.startDate}
                      max={campaign.endDate}
                      onChange={(e) => updateSlot(slot.slotId, { date: e.target.value })}
                    />
                    <input
                      type="time"
                      aria-label={`Heure de la publication ${index + 1}`}
                      className={inputClass}
                      value={slot.time}
                      onChange={(e) => updateSlot(slot.slotId, { time: e.target.value })}
                    />
                    <div className="space-y-1">
                      <input
                        aria-label={`Sujet de la publication ${index + 1}`}
                        className={inputClass}
                        value={slot.theme}
                        onChange={(e) => updateSlot(slot.slotId, { theme: e.target.value })}
                      />
                      <input
                        aria-label={`Rôle de la publication ${index + 1}`}
                        className={`${inputClass} text-muted`}
                        value={slot.role}
                        placeholder="Rôle dans la campagne"
                        onChange={(e) => updateSlot(slot.slotId, { role: e.target.value })}
                      />
                    </div>
                    <select
                      aria-label={`Type de la publication ${index + 1}`}
                      className={inputClass}
                      value={slot.kind}
                      onChange={(e) => updateSlot(slot.slotId, { kind: e.target.value as PostKind })}
                    >
                      {POST_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {POST_KIND_LABELS[kind]}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="ghost"
                      aria-label={`Retirer la publication ${index + 1}`}
                      onClick={() => setStrategy({ ...current, slots: current.slots.filter((s) => s.slotId !== slot.slotId) })}
                    >
                      Retirer
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  onClick={() =>
                    setStrategy({
                      ...current,
                      slots: [
                        ...current.slots,
                        { slotId: crypto.randomUUID(), date: campaign.endDate, time: campaign.defaultTime, theme: "", kind: "libre", role: "" },
                      ],
                    })
                  }
                >
                  Ajouter une publication
                </Button>
              </div>
              {canWrite ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => save(false)} disabled={busy !== null}>
                    {busy === "save" ? "Enregistrement…" : "Enregistrer"}
                  </Button>
                  <Button onClick={() => save(true)} disabled={busy !== null}>
                    {busy === "validate" ? "Validation…" : "Valider la stratégie"}
                  </Button>
                  {campaign.status === "strategy" && aiReady ? (
                    <Button variant="ghost" onClick={propose} disabled={busy !== null}>
                      {busy === "propose" ? "Nouvelle proposition…" : "Proposer une autre stratégie"}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-sm whitespace-pre-line">{current.summary}</p>
              {current.keyMessages.length > 0 ? (
                <ul className="list-disc pl-5 text-sm">
                  {current.keyMessages.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </Card>
      )}

      {campaign.status === "validated" && current ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Étape 9 : calendrier et publications</h2>
            <div className="flex flex-wrap gap-2">
              {pendingSlots > 0 && canWrite ? (
                <Button onClick={generateAll} disabled={busy !== null || !aiReady}>
                  {busy === "generate"
                    ? "Rédaction en cours…"
                    : `Rédiger les publications (${pendingSlots} créneau${pendingSlots > 1 ? "x" : ""}, environ ${Math.ceil(pendingSlots / batchSize)} génération${Math.ceil(pendingSlots / batchSize) > 1 ? "s" : ""})`}
                </Button>
              ) : null}
              {posts.some((p) => p.status === "draft") && canPublish ? (
                <Button variant="secondary" onClick={scheduleAll} disabled={busy !== null}>
                  {busy === "schedule" ? "Programmation…" : "Programmer les publications prêtes"}
                </Button>
              ) : null}
            </div>
          </div>
          <p className="text-xs text-muted">
            Une publication programmée partira automatiquement dès que le réseau concerné sera connecté (étape suivante du
            projet). Tant que ce n&apos;est pas le cas, rien n&apos;est envoyé.
          </p>

          <ol className="space-y-3">
            {current.slots.map((slot) => {
              const slotPosts = posts.filter((p) => p.slotId === slot.slotId);
              return (
                <li key={slot.slotId} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">
                    {new Date(`${slot.date}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })} à {slot.time} ·{" "}
                    {slot.theme}
                  </p>
                  {slot.role ? <p className="text-xs text-muted">{slot.role}</p> : null}
                  {slotPosts.length === 0 ? (
                    <p className="mt-2 text-xs text-muted">Pas encore rédigée.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {slotPosts.map((post) => (
                        <li key={post.id} className="rounded bg-background p-2 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span>
                              <span className="font-medium">{SOCIAL_NETWORKS[post.network].label}</span>
                              <span className="text-muted"> · {POST_STATUS_LABELS[post.status]}</span>
                              {post.localDate && (post.localDate !== slot.date || post.localTime !== slot.time) ? (
                                <span className="text-muted"> · déplacée au {post.localDate} {post.localTime}</span>
                              ) : null}
                            </span>
                            <span className="flex gap-3 text-xs">
                              <Link href={`/publications/${post.id}`} className="text-primary hover:underline">
                                Ouvrir
                              </Link>
                              {canWrite && ["draft", "failed"].includes(post.status) && aiReady ? (
                                <button
                                  type="button"
                                  className="text-primary hover:underline disabled:opacity-50"
                                  disabled={busy !== null}
                                  onClick={() => regenerate(post.id)}
                                >
                                  {busy === `regen-${post.id}` ? "Rédaction…" : "Régénérer"}
                                </button>
                              ) : null}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-muted">{post.excerpt}</p>
                          {post.problems.length > 0 && post.status === "draft" ? (
                            <p className="mt-1 text-xs text-danger">{post.problems.join(" ")}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>

          {skipped.length > 0 ? (
            <Alert>
              Publications non programmées :
              <ul className="mt-1 list-disc pl-5">
                {skipped.map((item) => (
                  <li key={item.postId}>
                    <Link href={`/publications/${item.postId}`} className="underline">
                      Ouvrir
                    </Link>{" "}
                    — {item.reason}
                  </li>
                ))}
              </ul>
            </Alert>
          ) : null}
        </Card>
      ) : null}

      {canWrite && !archived ? (
        <div className="flex justify-end">
          <Button variant="ghost" onClick={archive}>
            Archiver la campagne
          </Button>
        </div>
      ) : null}
    </div>
  );
}

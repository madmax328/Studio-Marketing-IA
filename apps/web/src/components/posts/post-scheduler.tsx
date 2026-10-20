"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PostStatus } from "@smia/shared";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import {
  duplicatePostAction,
  regenerateCampaignPostAction,
  setPostScheduleAction,
  unschedulePostAction,
} from "@/server/actions/campaigns";

export function PostScheduler({
  postId,
  status,
  localDate,
  localTime,
  timeZone,
  problems,
  canWrite,
  canPublish,
  canRegenerate,
  needsApproval = false,
}: {
  postId: string;
  status: PostStatus;
  localDate: string;
  localTime: string;
  timeZone: string;
  problems: string[];
  canWrite: boolean;
  canPublish: boolean;
  canRegenerate: boolean;
  /** L'espace exige une validation et cette personne ne peut pas valider elle-même. */
  needsApproval?: boolean;
}) {
  const router = useRouter();
  const [date, setDate] = useState(localDate);
  const [time, setTime] = useState(localTime || "12:00");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const movable = ["draft", "pending_approval", "scheduled", "failed"].includes(status);
  const planned = status === "scheduled" || status === "pending_approval";

  async function run(label: string, action: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>, success: string) {
    setBusy(label);
    setMessage(null);
    const result = await action();
    setBusy(null);
    setMessage(result.ok ? { tone: "success", text: success } : { tone: "error", text: result.error });
    if (result.ok) router.refresh();
    return result;
  }

  return (
    <div className="space-y-3">
      {movable && canWrite ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="block font-medium">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-border bg-surface px-2 py-1.5" />
          </label>
          <label className="text-sm">
            <span className="block font-medium">Heure</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-lg border border-border bg-surface px-2 py-1.5" />
          </label>
          <span className="pb-2 text-xs text-muted">({timeZone})</span>
        </div>
      ) : null}

      {problems.length > 0 && status !== "published" ? (
        <Alert tone="error">
          Avant de programmer : {problems.join(" ")}
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {movable && canWrite ? (
          <Button
            variant="secondary"
            disabled={busy !== null || !date}
            onClick={() =>
              run(
                "plan",
                () => setPostScheduleAction(postId, { date, time }, "plan"),
                status === "scheduled" && needsApproval
                  ? "Publication déplacée : elle repasse en validation."
                  : planned
                    ? "Publication déplacée."
                    : "Date enregistrée (brouillon).",
              )
            }
          >
            {planned ? "Déplacer" : "Enregistrer la date"}
          </Button>
        ) : null}
        {movable && canPublish && !planned ? (
          <Button
            disabled={busy !== null || !date || problems.length > 0}
            onClick={() =>
              run(
                "schedule",
                () => setPostScheduleAction(postId, { date, time }, "schedule"),
                needsApproval ? "Publication envoyée en validation : elle partira une fois validée." : "Publication programmée.",
              )
            }
          >
            {busy === "schedule" ? "Envoi…" : needsApproval ? "Demander la validation" : "Programmer"}
          </Button>
        ) : null}
        {planned && canPublish ? (
          <Button
            variant="ghost"
            disabled={busy !== null}
            onClick={() => run("unschedule", () => unschedulePostAction(postId), "Programmation annulée : la publication est redevenue un brouillon.")}
          >
            {status === "pending_approval" ? "Retirer la demande" : "Annuler la programmation"}
          </Button>
        ) : null}
        {canWrite ? (
          <Button
            variant="ghost"
            disabled={busy !== null}
            onClick={async () => {
              const result = await run("duplicate", () => duplicatePostAction(postId), "Copie créée.");
              if (result.ok) router.push(`/publications/${(result.data as { postId: string }).postId}`);
            }}
          >
            Dupliquer
          </Button>
        ) : null}
        {canRegenerate ? (
          <Button
            variant="ghost"
            disabled={busy !== null}
            onClick={() => run("regen", () => regenerateCampaignPostAction(postId, crypto.randomUUID()), "Nouvelle version rédigée.")}
          >
            {busy === "regen" ? "Rédaction…" : "Régénérer le texte"}
          </Button>
        ) : null}
      </div>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {status === "scheduled" ? (
        <p className="text-xs text-muted">
          La publication partira automatiquement à l&apos;heure prévue dès que le compte du réseau sera connecté.
          Tant qu&apos;aucun compte n&apos;est connecté, rien n&apos;est envoyé.
        </p>
      ) : null}
    </div>
  );
}

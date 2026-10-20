"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { INVITABLE_ROLES, ROLE_LABELS, type InvitableRole, type WorkspaceRole } from "@smia/shared";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import {
  changeMemberRoleAction,
  createClientSpaceAction,
  deleteClientSpaceAction,
  inviteMemberAction,
  leaveWorkspaceAction,
  removeMemberAction,
  renameWorkspaceAction,
  revokeInvitationAction,
  setApprovalRequiredAction,
  switchWorkspaceAction,
} from "@/server/actions/team";
import type { ActionResult } from "@/server/actions/studio";

const control =
  "rounded-xl border border-border bg-black/30 px-3.5 py-2.5 text-sm text-foreground transition hover:border-border-strong focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:opacity-60";

/** Exécute une action serveur puis rafraîchit la page ; garde le message d'erreur à afficher. */
function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (action: () => Promise<ActionResult<unknown>>, after?: () => void) =>
    start(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      after?.();
      router.refresh();
    });
  return { pending, error, run };
}

export function InviteForm({ canInviteAdmin }: { canInviteAdmin: boolean }) {
  const { pending, error, run } = useAction();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableRole>("editor");
  const [sent, setSent] = useState<string | null>(null);
  const roles = INVITABLE_ROLES.filter((item) => item !== "admin" || canInviteAdmin);
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        setSent(null);
        run(() => inviteMemberAction({ email, role }), () => {
          setSent(email);
          setEmail("");
        });
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="invite-email">
          Adresse e-mail
        </label>
        <input
          id="invite-email"
          type="email"
          required
          placeholder="adresse@exemple.fr"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={`${control} min-w-0 flex-1`}
        />
        <label className="sr-only" htmlFor="invite-role">
          Rôle
        </label>
        <select id="invite-role" value={role} onChange={(event) => setRole(event.target.value as InvitableRole)} className={control}>
          {roles.map((item) => (
            <option key={item} value={item}>
              {ROLE_LABELS[item].label}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={pending}>
          {pending ? "Envoi…" : "Inviter"}
        </Button>
      </div>
      <p className="text-xs text-muted">{ROLE_LABELS[role].description}</p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {sent ? <Alert tone="success">Invitation envoyée à {sent}. Le lien est valable 7 jours.</Alert> : null}
    </form>
  );
}

export function MemberControls({ userId, name, role, canEditAdmins }: { userId: string; name: string; role: WorkspaceRole; canEditAdmins: boolean }) {
  const { pending, error, run } = useAction();
  if (role === "owner" || (role === "admin" && !canEditAdmins)) return null;
  const roles = INVITABLE_ROLES.filter((item) => item !== "admin" || canEditAdmins);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`role-${userId}`}>
        Rôle de {name}
      </label>
      <select
        id={`role-${userId}`}
        value={role}
        disabled={pending}
        onChange={(event) => run(() => changeMemberRoleAction(userId, event.target.value))}
        className="rounded-lg border border-border bg-black/30 px-2 py-1 text-xs text-foreground"
      >
        {roles.map((item) => (
          <option key={item} value={item}>
            {ROLE_LABELS[item].label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        className="text-xs text-danger hover:underline disabled:opacity-50"
        onClick={() => {
          if (window.confirm(`Retirer ${name} de l'espace ? Cette personne n'y aura plus accès.`)) run(() => removeMemberAction(userId));
        }}
      >
        Retirer
      </button>
      {error ? <p className="w-full text-xs text-danger">{error}</p> : null}
    </div>
  );
}

export function RevokeInvitationButton({ invitationId, email }: { invitationId: string; email: string }) {
  const { pending, error, run } = useAction();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        className="text-xs text-danger hover:underline disabled:opacity-50"
        onClick={() => {
          if (window.confirm(`Annuler l'invitation de ${email} ? Le lien reçu ne fonctionnera plus.`)) run(() => revokeInvitationAction(invitationId));
        }}
      >
        Annuler l&apos;invitation
      </button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </>
  );
}

export function ApprovalToggle({ enabled }: { enabled: boolean }) {
  const { pending, error, run } = useAction();
  return (
    <div className="space-y-2">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          disabled={pending}
          onChange={(event) => run(() => setApprovalRequiredAction(event.target.checked))}
          className="mt-0.5 size-4 accent-[var(--primary)]"
        />
        <span>
          <span className="font-medium">Valider les publications avant leur envoi</span>
          <span className="block text-muted">
            Les publications programmées par un rédacteur attendent la validation d&apos;un administrateur ou d&apos;un client.
            Toute modification d&apos;une publication validée la renvoie en validation.
          </span>
        </span>
      </label>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}

export function RenameWorkspaceForm({ name: initial }: { name: string }) {
  const { pending, error, run } = useAction();
  const [name, setName] = useState(initial);
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => renameWorkspaceAction(name));
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="workspace-name">
          Nom de l&apos;espace
        </label>
        <input id="workspace-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} className={`${control} min-w-0 flex-1`} />
        <Button type="submit" variant="secondary" disabled={pending || name.trim() === initial}>
          Renommer
        </Button>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </form>
  );
}

export function CreateClientSpaceForm() {
  const { pending, error, run } = useAction();
  const router = useRouter();
  const [name, setName] = useState("");
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        run(async () => {
          const created = await createClientSpaceAction(name);
          if (!created.ok) return created;
          // On ouvre directement le nouvel espace pour y créer la marque du client.
          const switched = await switchWorkspaceAction(created.data.workspaceId);
          if (switched.ok) router.push("/ma-marque/nouvelle");
          return switched;
        });
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="client-name">
          Nom du client
        </label>
        <input
          id="client-name"
          required
          placeholder="Nom du client (ex. Boulangerie Martin)"
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          className={`${control} min-w-0 flex-1`}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer l'espace client"}
        </Button>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </form>
  );
}

export function ClientSpaceActions({ workspaceId, name, canDelete }: { workspaceId: string; name: string; canDelete: boolean }) {
  const { pending, error, run } = useAction();
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        className="text-xs text-primary hover:underline disabled:opacity-50"
        onClick={() =>
          run(
            () => switchWorkspaceAction(workspaceId),
            () => router.push("/tableau-de-bord"),
          )
        }
      >
        Ouvrir
      </button>
      {canDelete ? (
        <button
          type="button"
          disabled={pending}
          className="text-xs text-danger hover:underline disabled:opacity-50"
          onClick={() => {
            if (window.prompt(`Supprimer définitivement l'espace « ${name} » et tout son contenu (marques, publications, médias, comptes connectés) ? Tapez SUPPRIMER pour confirmer.`) === "SUPPRIMER") {
              run(() => deleteClientSpaceAction(workspaceId));
            }
          }}
        >
          Supprimer
        </button>
      ) : null}
      {error ? <p className="w-full text-xs text-danger">{error}</p> : null}
    </div>
  );
}

export function LeaveWorkspaceButton({ name }: { name: string }) {
  const { pending, error, run } = useAction();
  const router = useRouter();
  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => {
          if (window.confirm(`Quitter l'espace « ${name} » ? Vous n'y aurez plus accès sans nouvelle invitation.`)) {
            run(() => leaveWorkspaceAction(), () => router.push("/tableau-de-bord"));
          }
        }}
      >
        Quitter cet espace
      </Button>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}

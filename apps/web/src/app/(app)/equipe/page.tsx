import type { Metadata } from "next";
import Link from "next/link";
import { roleHasPermission, ROLE_LABELS } from "@smia/shared";
import {
  ApprovalToggle,
  ClientSpaceActions,
  CreateClientSpaceForm,
  InviteForm,
  LeaveWorkspaceButton,
  MemberControls,
  RenameWorkspaceForm,
  RevokeInvitationButton,
} from "@/components/team/team-controls";
import { Alert, Card } from "@/components/ui/card";
import { getDb } from "@/server/db/client";
import { getEffectivePlan } from "@/server/services/billing";
import { listClientSpaces, listWorkspaceSummaries } from "@/server/services/client-spaces";
import { getTeam } from "@/server/services/team";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Équipe" };

const date = (value: Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" }).format(value);

/** Équipe de l'espace, invitations, validation des publications et espaces clients (agences). */
export default async function TeamPage() {
  const access = await requireWorkspace();
  const db = getDb();
  const { workspace, role, userId } = access;
  const { members, invitations } = await getTeam(db, access);
  const { limits } = await getEffectivePlan(db, workspace);
  const canManage = roleHasPermission(role, "members:manage");
  const canManageWorkspace = roleHasPermission(role, "workspace:manage");
  const isClientSpace = Boolean(workspace.billingWorkspaceId);
  const clientSpaces = !isClientSpace && limits.maxClientSpaces > 0 ? await listClientSpaces(db, access) : [];
  const myWorkspaces = new Map((await listWorkspaceSummaries(db, userId)).map((item) => [item.id, item.role]));
  const used = members.length + invitations.length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">Équipe</h1>
        <p className="text-sm text-muted">
          {isClientSpace ? "Espace client" : "Espace"} « {workspace.name} » · vous êtes {ROLE_LABELS[role].label.toLowerCase()}.
        </p>
      </header>

      {isClientSpace ? (
        <Alert>
          Cet espace client dépend de l&apos;abonnement de l&apos;agence : ses crédits sont partagés avec l&apos;agence. Invitez votre
          client avec le rôle « Client (validation) » : il verra uniquement cet espace et validera les publications avant leur envoi.
        </Alert>
      ) : null}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Membres</h2>
          <p className="font-mono text-xs text-muted">
            {used} / {limits.maxMembers} {limits.maxMembers > 1 ? "personnes" : "personne"}
          </p>
        </div>
        <ul className="divide-y divide-border">
          {members.map((member) => (
            <li key={member.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {member.name}
                  {member.userId === userId ? <span className="text-muted"> (vous)</span> : null}
                </p>
                <p className="truncate text-xs text-muted">
                  {member.email} · {ROLE_LABELS[member.role].label} · depuis le {date(member.joinedAt)}
                </p>
              </div>
              {canManage && member.userId !== userId ? (
                <MemberControls userId={member.userId} name={member.name} role={member.role} canEditAdmins={role === "owner"} />
              ) : null}
            </li>
          ))}
        </ul>

        {invitations.length > 0 ? (
          <div className="space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-medium">Invitations en attente</h3>
            <ul className="space-y-2">
              {invitations.map((invitation) => (
                <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    {invitation.email} · {ROLE_LABELS[invitation.role].label}
                    <span className="text-xs text-muted"> · expire le {date(invitation.expiresAt)}</span>
                  </span>
                  <RevokeInvitationButton invitationId={invitation.id} email={invitation.email} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {canManage ? (
          <div className="space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-medium">Inviter quelqu&apos;un</h3>
            {used >= limits.maxMembers ? (
              <p className="text-sm text-muted">
                Votre offre est complète.{" "}
                <Link href="/abonnement" className="text-primary hover:underline">
                  Voir les offres
                </Link>{" "}
                pour agrandir l&apos;équipe.
              </p>
            ) : (
              <InviteForm canInviteAdmin={role === "owner"} />
            )}
          </div>
        ) : null}
      </Card>

      {canManageWorkspace ? (
        <Card className="space-y-4">
          <h2 className="font-semibold">Réglages de l&apos;espace</h2>
          <RenameWorkspaceForm name={workspace.name} />
          <ApprovalToggle enabled={workspace.approvalRequired === true} />
        </Card>
      ) : null}

      {!isClientSpace && limits.maxClientSpaces > 0 ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">Espaces clients</h2>
            <p className="font-mono text-xs text-muted">
              {clientSpaces.length} / {limits.maxClientSpaces}
            </p>
          </div>
          <p className="text-sm text-muted">
            Un espace par client : ses marques, ses réseaux et ses publications restent séparés, et vous pouvez l&apos;y inviter
            pour qu&apos;il valide les publications. Les crédits sont ceux de votre abonnement.
          </p>
          {clientSpaces.length > 0 ? (
            <ul className="divide-y divide-border">
              {clientSpaces.map((space) => {
                const myRole = myWorkspaces.get(space.id);
                return (
                  <li key={space.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium">{space.name}</p>
                      <p className="text-xs text-muted">Créé le {date(space.createdAt)}{myRole ? "" : " · vous n'en êtes pas membre"}</p>
                    </div>
                    {myRole ? <ClientSpaceActions workspaceId={space.id} name={space.name} canDelete={myRole === "owner"} /> : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {canManageWorkspace && clientSpaces.length < limits.maxClientSpaces ? <CreateClientSpaceForm /> : null}
        </Card>
      ) : !isClientSpace && canManageWorkspace ? (
        <Card className="space-y-2">
          <h2 className="font-semibold">Vous gérez plusieurs clients ?</h2>
          <p className="text-sm text-muted">
            L&apos;offre Agence donne un espace séparé par client, avec ses propres accès et la validation des publications par le
            client.{" "}
            <Link href="/abonnement" className="text-primary hover:underline">
              Voir les offres
            </Link>
          </p>
        </Card>
      ) : null}

      {role !== "owner" ? (
        <Card className="space-y-3">
          <h2 className="font-semibold">Quitter l&apos;espace</h2>
          <LeaveWorkspaceButton name={workspace.name} />
        </Card>
      ) : null}
    </div>
  );
}

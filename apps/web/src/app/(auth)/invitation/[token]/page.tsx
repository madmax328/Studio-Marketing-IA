import type { Metadata } from "next";
import Link from "next/link";
import { ROLE_LABELS } from "@smia/shared";
import { AcceptInvitationButton } from "@/components/team/accept-invitation";
import { buttonStyles } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { getDb } from "@/server/db/client";
import { describeInvitation } from "@/server/services/team";
import { getSession } from "@/server/session";

export const metadata: Metadata = { title: "Invitation", robots: { index: false } };

/** Lien reçu par e-mail : rejoindre un espace, après connexion avec l'adresse invitée. */
export default async function InvitationPage({ params }: PageProps<"/invitation/[token]">) {
  const { token } = await params;
  const session = await getSession();
  const invitation = await describeInvitation(getDb(), token);

  if (!invitation) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">Invitation introuvable</h1>
        <p className="text-sm text-muted">
          Ce lien a expiré, a déjà servi ou a été annulé. Demandez une nouvelle invitation à la personne qui vous l&apos;a envoyée.
        </p>
        <Link href={session ? "/tableau-de-bord" : "/"} className={buttonStyles("secondary")}>
          {session ? "Aller au tableau de bord" : "Retour au site"}
        </Link>
      </div>
    );
  }

  const next = `/invitation/${token}`;
  const sameEmail = session?.user.email.trim().toLowerCase() === invitation.email;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-[-0.03em]">Rejoindre « {invitation.workspaceName} »</h1>
      <p className="text-sm text-muted">
        {invitation.inviterName ? `${invitation.inviterName} vous invite` : "Vous êtes invité"} en tant que{" "}
        <strong className="text-foreground">{ROLE_LABELS[invitation.role].label.toLowerCase()}</strong> :{" "}
        {ROLE_LABELS[invitation.role].description.toLowerCase()}
      </p>
      {!session ? (
        <>
          <p className="text-sm">
            Connectez-vous ou créez votre compte avec l&apos;adresse <strong>{invitation.email}</strong>.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/connexion?suite=${encodeURIComponent(next)}`} className={buttonStyles("primary")}>
              Me connecter
            </Link>
            <Link href={`/inscription?suite=${encodeURIComponent(next)}`} className={buttonStyles("secondary")}>
              Créer mon compte
            </Link>
          </div>
        </>
      ) : !session.user.emailVerified ? (
        <Alert>Confirmez d&apos;abord votre adresse e-mail (lien reçu à l&apos;inscription), puis rouvrez cette invitation.</Alert>
      ) : !sameEmail ? (
        <Alert tone="error">
          Cette invitation est destinée à {invitation.email}, mais vous êtes connecté avec {session.user.email}. Déconnectez-vous,
          puis rouvrez ce lien et connectez-vous avec la bonne adresse.
        </Alert>
      ) : (
        <AcceptInvitationButton token={token} />
      )}
    </div>
  );
}

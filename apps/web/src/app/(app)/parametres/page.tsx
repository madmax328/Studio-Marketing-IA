import { ROLE_LABELS } from "@smia/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAccount } from "@/components/settings/delete-account";
import { RevokeOtherSessions } from "@/components/settings/sessions";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser, requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Paramètres" };


export default async function SettingsPage() {
  const user = await requireUser();
  const { workspace, role } = await requireWorkspace();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">Paramètres</h1>

      <Card className="space-y-2">
        <h2 className="font-semibold">Mon compte</h2>
        <p className="text-sm">
          {user.name} · {user.email}
        </p>
        <p className="text-sm text-muted">
          Espace : {workspace.name} ({ROLE_LABELS[role].label})
        </p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Sécurité</h2>
        <RevokeOtherSessions />
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Votre avis</h2>
        <p className="text-sm text-muted">Dites-nous ce que vous pensez du studio. Vous pouvez modifier ou retirer votre avis à tout moment.</p>
        <Link href="/avis" className={buttonStyles("secondary")}>
          Donner ou modifier mon avis
        </Link>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Mes données</h2>
        <p className="text-sm text-muted">Téléchargez toutes vos données au format JSON.</p>
        <a href="/api/compte/export" className={buttonStyles("secondary")} download>
          Exporter mes données
        </a>
      </Card>

      <Card className="space-y-3 border-danger/40">
        <h2 className="font-semibold text-danger">Supprimer mon compte</h2>
        <DeleteAccount />
      </Card>
    </div>
  );
}

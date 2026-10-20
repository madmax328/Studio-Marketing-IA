import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { LEGAL, legalValue } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Suppression des données",
  description: "Comment supprimer votre compte et toutes vos données, ou retirer l'accès à un réseau social.",
};

/** Instructions de suppression des données (également exigées par Meta pour les applications connectées). */
export default async function DataDeletionPage({ searchParams }: PageProps<"/suppression-des-donnees">) {
  const { demande } = await searchParams;
  const code = typeof demande === "string" && /^[A-Za-z0-9_-]{6,40}$/.test(demande) ? demande : null;
  return (
    <LegalPage
      title="Suppression des données"
      current="/suppression-des-donnees"
      intro="Vous pouvez supprimer à tout moment votre compte et toutes les données associées, ou seulement retirer l'accès à un réseau social."
    >
      {code ? (
        <p className="rounded-xl border border-line bg-white/[0.03] p-4">
          Demande <strong>{code}</strong> reçue : les autorisations et les comptes liés à votre profil sur ce réseau ont été
          supprimés de notre service.
        </p>
      ) : null}

      <h2>Supprimer votre compte et toutes vos données</h2>
      <ol className="list-decimal pl-5">
        <li>Connectez-vous, puis ouvrez « Paramètres ».</li>
        <li>
          Dans « Supprimer mon compte », confirmez la suppression. Si vous le souhaitez, téléchargez d&apos;abord vos données
          avec « Exporter mes données ».
        </li>
      </ol>
      <p>La suppression est immédiate et définitive. Elle efface :</p>
      <ul>
        <li>votre compte, vos espaces de travail et vos fiches de marque ;</li>
        <li>vos publications, campagnes, statistiques, alertes et historiques de génération ;</li>
        <li>vos images et visuels stockés ;</li>
        <li>les autorisations et jetons d&apos;accès de vos comptes sociaux connectés ;</li>
        <li>votre solde de crédits ; votre abonnement éventuel est résilié automatiquement avant la suppression.</li>
      </ul>
      <p>
        Les factures restent conservées par notre prestataire de paiement (Stripe) pendant la durée imposée par la loi.
        Les publications déjà parues sur vos réseaux sociaux restent sur ces réseaux : supprimez-les depuis chaque réseau
        si vous le souhaitez.
      </p>

      <h2>Retirer l&apos;accès à un réseau social</h2>
      <p>
        Dans « Réseaux sociaux », cliquez sur « Déconnecter » : le jeton d&apos;accès est immédiatement effacé de notre base.
        Vous pouvez aussi retirer l&apos;autorisation directement depuis le réseau :
      </p>
      <ul>
        <li>Facebook et Instagram : Paramètres et confidentialité → Paramètres → Intégrations professionnelles.</li>
        <li>Threads : Paramètres → Compte → Sites web autorisés.</li>
        <li>LinkedIn : Préférences → Confidentialité des données → Services autorisés.</li>
      </ul>

      <h2>Vous n&apos;avez plus accès à votre compte ?</h2>
      <p>
        Écrivez-nous à {legalValue(LEGAL.contactEmail, "adresse de contact bientôt disponible")} depuis l&apos;adresse
        e-mail de votre compte. Nous supprimerons vos données dans un délai d&apos;un mois au plus.
      </p>
    </LegalPage>
  );
}

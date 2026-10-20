import type { Metadata } from "next";
import { CREDIT_COSTS } from "@smia/shared";
import { LegalPage } from "@/components/legal/legal-page";
import { LEGAL, legalValue, publisherName } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Conditions générales",
  description: "Conditions générales d'utilisation et de vente de Studio Marketing IA.",
};

export default function TermsPage() {
  const contact = legalValue(LEGAL.contactEmail, "adresse de contact bientôt disponible");
  return (
    <LegalPage
      title="Conditions générales d'utilisation et de vente"
      current="/conditions"
      intro={`Ces conditions encadrent l'utilisation de ${LEGAL.serviceName} et la souscription de ses offres. En créant un compte, vous les acceptez.`}
    >
      <h2>1. Le service</h2>
      <p>
        {LEGAL.serviceName}, édité par {publisherName()} (l&apos;« éditeur »), permet de décrire son activité,
        de faire rédiger des publications par intelligence artificielle, de créer des visuels, de les programmer et de les
        publier automatiquement sur des réseaux sociaux connectés, puis d&apos;en consulter les statistiques.
      </p>
      <p>
        Les réseaux disponibles et leur état sont indiqués sur le site. La disponibilité d&apos;un réseau dépend des
        conditions et des validations de chaque plateforme, qui peuvent évoluer sans préavis de leur part.
      </p>

      <h2>2. Compte</h2>
      <ul>
        <li>Vous devez être majeur ou agir pour le compte d&apos;une organisation qui vous y autorise.</li>
        <li>Les informations fournies doivent être exactes ; votre adresse e-mail doit être confirmée.</li>
        <li>Vous êtes responsable de la confidentialité de votre mot de passe et des actions faites depuis votre compte.</li>
        <li>Vous pouvez supprimer votre compte à tout moment depuis « Paramètres ».</li>
      </ul>

      <h2>3. Vos contenus et vos publications</h2>
      <p>
        Les informations, images et publications que vous créez ou importez restent votre propriété. Vous accordez à
        l&apos;éditeur le droit de les stocker et de les traiter uniquement pour fournir le service (rédaction, création
        des visuels, publication sur les comptes que vous avez connectés).
      </p>
      <p>
        <strong>Vous restez responsable de ce qui est publié en votre nom.</strong> Les textes proposés par l&apos;IA doivent
        être relus avant leur programmation : l&apos;IA peut se tromper, même si elle a pour consigne de n&apos;utiliser que
        les informations de votre fiche. Vous vous engagez à détenir les droits sur les images importées et à respecter les
        règles de chaque réseau social ainsi que la loi (publicité trompeuse, droit à l&apos;image, propriété intellectuelle,
        contenus illicites).
      </p>

      <h2>4. Connexion aux réseaux sociaux</h2>
      <p>
        La connexion d&apos;un compte se fait sur la page officielle du réseau, avec les autorisations que vous accordez.
        Une publication ne part que si vous l&apos;avez programmée. L&apos;éditeur ne peut être tenu responsable d&apos;un refus,
        d&apos;un retard ou d&apos;une suppression décidés par un réseau, ni d&apos;une interruption de ses services. En cas
        d&apos;échec d&apos;envoi, vous êtes prévenu dans l&apos;application et par e-mail.
      </p>

      <h2>5. Offres, prix et paiement</h2>
      <ul>
        <li>Une offre gratuite, limitée, est disponible sans moyen de paiement.</li>
        <li>
          Les offres payantes sont des abonnements mensuels ou annuels, aux prix affichés sur la page{" "}
          <a href="/tarifs">Tarifs</a> au moment de la souscription. Le paiement est traité par Stripe ; l&apos;éditeur n&apos;a
          jamais accès à vos données bancaires.
        </li>
        <li>L&apos;abonnement est renouvelé automatiquement à chaque échéance, jusqu&apos;à sa résiliation.</li>
        <li>
          En cas d&apos;échec de paiement, l&apos;offre reste active pendant les relances de Stripe, puis revient à l&apos;offre
          gratuite si le paiement n&apos;aboutit pas.
        </li>
        <li>Toute modification de prix vous est annoncée avant votre prochaine échéance ; vous pouvez alors résilier.</li>
      </ul>

      <h2>6. Crédits d&apos;intelligence artificielle</h2>
      <p>
        Chaque offre comprend un nombre de crédits par mois. Écrire des publications dans le studio consomme{" "}
        {CREDIT_COSTS.text_generation} crédit, proposer le plan d&apos;une campagne {CREDIT_COSTS.campaign_strategy}, écrire un
        lot de publications de campagne {CREDIT_COSTS.campaign_posts}. Les crédits non utilisés ne sont pas reportés au mois
        suivant. Un appel à l&apos;IA qui échoue est automatiquement remboursé. Les visuels par modèle et la publication ne
        consomment pas de crédits.
      </p>

      <h2>7. Résiliation et droit de rétractation</h2>
      <p>
        Vous pouvez résilier à tout moment depuis « Abonnement » ; l&apos;offre reste active jusqu&apos;à la fin de la
        période déjà payée, sans remboursement de la période en cours, puis vous repassez sur l&apos;offre gratuite.
      </p>
      <p>
        Si vous êtes un consommateur, vous disposez d&apos;un délai de rétractation de 14 jours à compter de la souscription.
        Si vous demandez à utiliser le service payant avant la fin de ce délai, vous restez redevable d&apos;un montant
        proportionnel au service fourni jusqu&apos;à votre rétractation. Pour vous rétracter : {contact}.
      </p>

      <h2>8. Disponibilité et évolutions</h2>
      <p>
        L&apos;éditeur s&apos;efforce d&apos;assurer un service disponible et fiable, sans garantie d&apos;absence
        d&apos;interruption (maintenance, panne d&apos;un prestataire ou d&apos;un réseau). Les fonctionnalités peuvent évoluer ;
        une fonctionnalité annoncée « bientôt » n&apos;est pas due avant sa mise en service.
      </p>

      <h2>9. Responsabilité</h2>
      <p>
        L&apos;éditeur est tenu d&apos;une obligation de moyens. Sauf faute lourde ou disposition légale contraire, sa
        responsabilité envers un professionnel est limitée aux sommes payées au cours des douze derniers mois. Elle ne
        couvre pas les contenus publiés par l&apos;utilisateur ni les décisions des réseaux sociaux.
      </p>

      <h2>10. Suspension</h2>
      <p>
        L&apos;éditeur peut suspendre un compte en cas d&apos;utilisation contraire à la loi, aux présentes conditions ou aux
        règles des réseaux (spam, contenus illicites, tentative d&apos;intrusion), après avertissement sauf urgence.
      </p>

      <h2>11. Données personnelles</h2>
      <p>
        Voir la <a href="/confidentialite">politique de confidentialité</a> et la page{" "}
        <a href="/suppression-des-donnees">suppression des données</a>.
      </p>

      <h2>12. Modification des conditions</h2>
      <p>
        Vous êtes prévenu de toute modification importante au moins 30 jours avant son entrée en vigueur. Si vous ne
        l&apos;acceptez pas, vous pouvez résilier avant cette date.
      </p>

      <h2>13. Droit applicable et litiges</h2>
      <p>
        Ces conditions sont soumises au droit français. En cas de litige, contactez-nous d&apos;abord : {contact}. Si vous êtes
        un consommateur, vous pouvez recourir gratuitement au médiateur de la consommation :{" "}
        {LEGAL.mediator.name ? (
          LEGAL.mediator.url ? <a href={LEGAL.mediator.url}>{LEGAL.mediator.name}</a> : LEGAL.mediator.name
        ) : (
          "(médiateur en cours de désignation)"
        )}
        . À défaut d&apos;accord, les tribunaux compétents sont ceux désignés par la loi.
      </p>
    </LegalPage>
  );
}

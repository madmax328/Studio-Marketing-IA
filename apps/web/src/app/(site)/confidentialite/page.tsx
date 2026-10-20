import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { LEGAL, legalValue, publisherName, SUBPROCESSORS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Quelles données Studio Marketing IA traite, pourquoi, combien de temps, et comment exercer vos droits.",
};

const DATA = [
  {
    what: "Compte : nom, adresse e-mail, mot de passe (stocké chiffré de façon irréversible)",
    why: "Créer et sécuriser votre compte",
    basis: "Exécution du contrat",
    duration: "Jusqu'à la suppression du compte",
  },
  {
    what: "Fiche de votre activité, publications, campagnes, images et visuels",
    why: "Fournir le service (rédaction, programmation, publication)",
    basis: "Exécution du contrat",
    duration: "Jusqu'à leur suppression ou celle du compte",
  },
  {
    what: "Autorisations des réseaux sociaux connectés (jetons d'accès chiffrés), nom et identifiant des comptes",
    why: "Publier et relever les statistiques sur les comptes que vous connectez",
    basis: "Exécution du contrat",
    duration: "Jusqu'à la déconnexion du compte ou la suppression de votre compte",
  },
  {
    what: "Statistiques des publications (vues, j'aime, commentaires…) fournies par les réseaux",
    why: "Afficher vos résultats et vous conseiller",
    basis: "Exécution du contrat",
    duration: "Jusqu'à la suppression du compte",
  },
  {
    what: "Abonnement et consommation de crédits (offre, statut, historique des crédits)",
    why: "Facturer et appliquer les limites de votre offre",
    basis: "Exécution du contrat ; obligations comptables (factures conservées par Stripe)",
    duration: "Jusqu'à la suppression du compte ; factures : durée légale",
  },
  {
    what: "Votre avis sur le service, si vous en laissez un (note, texte, nom et activité affichés, ville)",
    why: "Améliorer le service ; publication sur le site uniquement avec votre accord",
    basis: "Consentement (publication), intérêt légitime (amélioration)",
    duration: "Jusqu'à ce que vous le retiriez ou supprimiez votre compte",
  },
  {
    what: "Journal de sécurité (connexions, actions sensibles, sans contenu privé) et données techniques (adresse IP)",
    why: "Sécuriser le service, limiter les abus",
    basis: "Intérêt légitime",
    duration: "Durée limitée nécessaire à la sécurité ; supprimé avec le compte",
  },
];

export default function PrivacyPage() {
  const contact = legalValue(LEGAL.contactEmail, "adresse de contact bientôt disponible");
  return (
    <LegalPage
      title="Politique de confidentialité"
      current="/confidentialite"
      intro="Nous collectons le minimum nécessaire pour faire fonctionner le service, nous ne vendons aucune donnée et nous n'utilisons aucun traceur publicitaire."
    >
      <h2>Responsable du traitement</h2>
      <p>
        {publisherName()}, éditeur du service (voir les <a href="/mentions-legales">mentions légales</a>).
        Contact pour toute question sur vos données : {contact}.
      </p>

      <h2>Données traitées</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th scope="col">Données</th>
              <th scope="col">Pourquoi</th>
              <th scope="col">Base légale</th>
              <th scope="col">Durée</th>
            </tr>
          </thead>
          <tbody>
            {DATA.map((row) => (
              <tr key={row.what}>
                <td>{row.what}</td>
                <td>{row.why}</td>
                <td>{row.basis}</td>
                <td>{row.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Intelligence artificielle</h2>
      <p>
        Pour rédiger vos publications, les informations de votre fiche et votre demande sont envoyées à notre fournisseur
        d&apos;intelligence artificielle. Pour créer une image, seuls votre description, le secteur et les couleurs de votre
        marque sont envoyés au fournisseur d&apos;images. Chaque envoi n&apos;a lieu qu&apos;après votre accord explicite,
        donné une fois par espace de travail et par fournisseur. Ne saisissez pas dans le studio de données personnelles de tiers dont vous n&apos;avez pas
        besoin. Nous n&apos;utilisons pas vos contenus pour entraîner des modèles d&apos;IA.
      </p>

      <h2>Réseaux sociaux</h2>
      <p>
        Lorsque vous connectez un compte, la connexion se fait sur la page officielle du réseau : nous ne voyons jamais
        votre mot de passe. Nous recevons uniquement les autorisations que vous accordez (publier, lire les statistiques de
        vos publications), et nous ne les utilisons que pour ces actions, à votre demande. Les jetons d&apos;accès sont
        chiffrés et ne sont jamais affichés.
      </p>

      <h2>Destinataires et sous-traitants</h2>
      <p>Vos données ne sont ni vendues ni louées. Elles sont traitées par les prestataires nécessaires au service :</p>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th scope="col">Prestataire</th>
              <th scope="col">Rôle</th>
              <th scope="col">Localisation</th>
            </tr>
          </thead>
          <tbody>
            {SUBPROCESSORS.map((item) => (
              <tr key={item.name}>
                <td>{item.name}</td>
                <td>{item.role}</td>
                <td>{item.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Certains prestataires sont situés hors de l&apos;Union européenne. Les transferts sont encadrés par les clauses
        contractuelles types de la Commission européenne ou par le cadre de protection des données UE–États-Unis.
      </p>

      <h2>Cookies</h2>
      <p>Nous n&apos;utilisons que des cookies strictement nécessaires, qui ne demandent pas de consentement :</p>
      <ul>
        <li>la session de connexion (30 jours au plus) ;</li>
        <li>l&apos;espace de travail sélectionné ;</li>
        <li>la vérification de sécurité lors de la connexion d&apos;un réseau social (10 minutes).</li>
      </ul>
      <p>Aucun cookie publicitaire, aucun outil de mesure d&apos;audience tiers.</p>

      <h2>Sécurité</h2>
      <p>
        Connexions chiffrées (HTTPS), mots de passe hachés, jetons d&apos;accès chiffrés, cloisonnement strict des données
        entre espaces de travail, limitation des tentatives de connexion, journal des actions sensibles.
      </p>

      <h2>Vos droits</h2>
      <p>
        Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de limitation, d&apos;opposition et de
        portabilité de vos données. Vous pouvez directement :
      </p>
      <ul>
        <li>télécharger toutes vos données depuis « Paramètres » → « Exporter mes données » ;</li>
        <li>modifier vos informations depuis l&apos;application ;</li>
        <li>
          supprimer votre compte et toutes vos données : voir <a href="/suppression-des-donnees">suppression des données</a>.
        </li>
      </ul>
      <p>
        Pour toute autre demande : {contact}. Nous répondons dans un délai d&apos;un mois. Vous pouvez aussi adresser une
        réclamation à la CNIL (<a href="https://www.cnil.fr">www.cnil.fr</a>).
      </p>

      <h2>Modifications</h2>
      <p>
        En cas de changement important de cette politique, nous vous prévenons par e-mail ou dans l&apos;application avant
        son entrée en vigueur.
      </p>
    </LegalPage>
  );
}

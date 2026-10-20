import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { HOSTING, LEGAL, legalValue } from "@/lib/legal";

export const metadata: Metadata = { title: "Mentions légales", description: "Éditeur, hébergeur et informations légales de Studio Marketing IA." };

export default function LegalNoticePage() {
  return (
    <LegalPage title="Mentions légales" current="/mentions-legales">
      <h2>Éditeur du service</h2>
      <p>
        Le service <strong>{LEGAL.serviceName}</strong> est édité par :
      </p>
      <ul>
        <li>Raison sociale : {legalValue(LEGAL.companyName)}</li>
        <li>Forme juridique et capital : {legalValue(LEGAL.legalForm)}</li>
        <li>SIRET : {legalValue(LEGAL.siret)}</li>
        <li>Immatriculation : {legalValue(LEGAL.rcs)}</li>
        <li>TVA intracommunautaire : {legalValue(LEGAL.vatNumber)}</li>
        <li>Siège : {legalValue(LEGAL.address)}</li>
        <li>Directeur de la publication : {legalValue(LEGAL.publicationDirector, "à compléter")}</li>
        <li>Contact : {legalValue(LEGAL.contactEmail, "adresse de contact bientôt disponible")}</li>
      </ul>

      <h2>Hébergement</h2>
      <p>
        Le site et l&apos;application sont hébergés par {HOSTING.name}, {HOSTING.address} (<a href={HOSTING.url}>{HOSTING.url}</a>).
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Les textes, éléments graphiques, logos et le logiciel du service sont protégés par le droit de la propriété
        intellectuelle. Toute reproduction sans autorisation est interdite. Les contenus que vous créez avec le service
        vous appartiennent : voir les <a href="/conditions">conditions générales</a>.
      </p>
      <p>La police de caractères des visuels (Montserrat) est utilisée sous licence SIL Open Font License.</p>

      <h2>Marques des réseaux sociaux</h2>
      <p>
        Facebook, Instagram et Threads sont des marques de Meta Platforms, Inc. LinkedIn est une marque de LinkedIn
        Corporation. YouTube et Google Business Profile sont des marques de Google LLC. TikTok, Pinterest et X appartiennent à leurs propriétaires respectifs. {LEGAL.serviceName}{" "}
        n&apos;est ni affilié à ces sociétés ni approuvé par elles.
      </p>

      <h2>Données personnelles</h2>
      <p>
        Le traitement de vos données est décrit dans la <a href="/confidentialite">politique de confidentialité</a>.
      </p>
    </LegalPage>
  );
}

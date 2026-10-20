import type { Metadata } from "next";
import Link from "next/link";
import { CREDIT_COSTS, SOCIAL_NETWORK_IDS, SOCIAL_NETWORKS, type IntegrationStatus } from "@smia/shared";
import { DepartureBoard } from "@/components/site/departure-board";
import { PlanTickets } from "@/components/site/plan-tickets";
import { SectionTitle } from "@/components/site/section-title";
import { cn } from "@/lib/cn";
import { getPublicPlans } from "@/server/services/public-plans";

export const metadata: Metadata = {
  title: { absolute: "Studio Marketing IA · Vos réseaux sociaux en pilote automatique" },
  description:
    "Décrivez votre commerce une fois : le studio rédige vos publications, prépare vos visuels et les publie à l'heure prévue sur chaque réseau.",
};

/** Les offres (base + Stripe) sont relues toutes les heures. */
export const revalidate = 3600;

/** La boucle du produit, comme une ligne aérienne avec ses escales (codes à trois lettres). */
const ROUTE: { code: string; name: string; text: string; ready: boolean }[] = [
  {
    code: "MRQ",
    name: "Décrire",
    text: "Votre activité, vos produits, vos prix, votre ton : vous l'expliquez une fois, le studio s'en souvient.",
    ready: true,
  },
  {
    code: "CRE",
    name: "Créer",
    text: "L'IA rédige une version adaptée à chaque réseau. Les visuels reprennent votre logo et vos couleurs.",
    ready: true,
  },
  {
    code: "PUB",
    name: "Publier",
    text: "Vous validez, vous programmez : la publication part seule à l'heure prévue, sur le bon compte.",
    ready: true,
  },
  {
    code: "ANA",
    name: "Analyser",
    text: "Les résultats réels de chaque publication, tels que les réseaux les fournissent.",
    ready: false,
  },
  {
    code: "AML",
    name: "Améliorer",
    text: "Le studio repère ce qui marche chez vous et en tient compte pour les publications suivantes.",
    ready: false,
  },
];

const ON_BOARD = [
  { label: "Mémoire de marque", text: "Produits, prix, horaires, ton, mots à éviter : la base de tout ce que l'IA écrit." },
  { label: "Studio de rédaction", text: "Une idée, plusieurs réseaux : chaque texte respecte la longueur et les usages du réseau." },
  { label: "Visuels à votre image", text: "Gabarits carrés, portrait, vertical ou paysage, avec votre logo et vos couleurs." },
  { label: "Campagnes guidées", text: "Un assistant en 9 étapes propose une stratégie, vous l'ajustez, il rédige tout le plan." },
  { label: "Calendrier", text: "Mois, semaine ou liste : vous voyez ce qui part, quand, et où. Changements d'heure compris." },
  { label: "Envoi automatique", text: "Nouvel essai si un réseau est indisponible, alerte par e-mail si quelque chose bloque." },
];

const GATE_STATUS: Record<IntegrationStatus, { label: string; className: string }> = {
  available: { label: "Porte ouverte", className: "bg-runway text-ink" },
  in_development: { label: "Essais en cours", className: "bg-signal text-ink" },
  planned: { label: "Prochainement", className: "border border-paper/25 text-paper/60" },
};

const NEVER = [
  {
    title: "Inventer vos prix ou vos promotions",
    text: "L'IA n'utilise que ce que vous avez écrit dans « Ma marque ». S'il manque une information, elle vous le signale au lieu de l'inventer.",
  },
  {
    title: "Vous demander le mot de passe de vos réseaux",
    text: "La connexion passe toujours par la page officielle du réseau. Vous pouvez retirer l'autorisation à tout moment.",
  },
  {
    title: "Afficher de faux chiffres",
    text: "Pas de statistiques gonflées ni d'exemples présentés comme réels : un essai sans publication est marqué « Simulée ».",
  },
  {
    title: "Publier sans votre accord",
    text: "Rien ne part tant que vous n'avez pas programmé la publication. Vous pouvez la décaler ou l'annuler jusqu'au dernier moment.",
  },
  {
    title: "Garder vos données",
    text: "Export complet en un clic, suppression définitive du compte et de vos fichiers quand vous le décidez.",
  },
];

/** Réponse construite à partir de l'état réel de chaque intégration (jamais en avance sur la réalité). */
function networksAnswer(): string {
  const byStatus = (status: IntegrationStatus) =>
    SOCIAL_NETWORK_IDS.filter((id) => SOCIAL_NETWORKS[id].integrationStatus === status).map((id) => SOCIAL_NETWORKS[id].label);
  const list = (labels: string[]) => (labels.length > 1 ? `${labels.slice(0, -1).join(", ")} et ${labels.at(-1)}` : (labels[0] ?? ""));
  const parts = [
    byStatus("available").length > 0 ? `Disponibles : ${list(byStatus("available"))}.` : "",
    byStatus("in_development").length > 0 ? `En essai sur de vrais comptes : ${list(byStatus("in_development"))}.` : "",
    byStatus("planned").length > 0 ? `Prochainement : ${list(byStatus("planned"))}.` : "",
  ];
  return `${parts.filter(Boolean).join(" ")} Un réseau n'est déclaré disponible qu'après une publication réussie sur un vrai compte.`;
}

const FAQ: { q: string; a: string }[] = [
  {
    q: "Je ne suis pas du tout « réseaux sociaux ». C'est fait pour moi ?",
    a: "Oui, c'est même le point de départ : vous décrivez votre commerce avec des mots simples, le studio s'occupe du reste. Vous gardez la main pour relire et valider chaque publication.",
  },
  {
    q: "Sur quels réseaux puis-je publier ?",
    a: networksAnswer(),
  },
  {
    q: "L'IA peut-elle écrire n'importe quoi sur mon commerce ?",
    a: "Elle s'appuie uniquement sur votre fiche « Ma marque ». Elle n'invente ni prix, ni promotion, ni coordonnées, et chaque publication reste modifiable avant son départ.",
  },
  {
    q: "Qu'est-ce qu'un crédit IA ?",
    a: `C'est l'unité de consommation de l'IA. Une génération dans le studio coûte ${CREDIT_COSTS.text_generation} crédit, une stratégie de campagne ${CREDIT_COSTS.campaign_strategy}, la rédaction d'un lot de publications de campagne ${CREDIT_COSTS.campaign_posts}. Les visuels par gabarit et l'envoi des publications ne consomment rien, et un appel qui échoue est remboursé.`,
  },
  {
    q: "Et les vidéos ?",
    a: "Pas encore : la V1 publie des textes et des images. La création de vidéos à partir de gabarits est prévue dans une prochaine version.",
  },
  {
    q: "Que deviennent mes données ?",
    a: "Elles sont isolées dans votre espace. Vous pouvez tout exporter ou supprimer votre compte depuis les paramètres ; l'abonnement éventuel est résilié automatiquement.",
  },
];

export default async function HomePage() {
  const plans = await getPublicPlans();

  return (
    <>
      {/* ---------- Départ ---------- */}
      <section className="tarmac relative overflow-hidden text-paper">
        <div aria-hidden="true" className="pointer-events-none absolute -top-40 -right-40 size-[34rem] rounded-full border border-signal/15">
          <div className="radar-sweep absolute inset-0 rounded-full" />
          <div className="absolute inset-16 rounded-full border border-signal/10" />
          <div className="absolute inset-32 rounded-full border border-signal/10" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24">
          <p className="font-board text-xs tracking-[0.25em] text-signal uppercase">Vol SMIA-01 · Commandant : vous · Pilote : automatique</p>
          <h1 className="mt-6 max-w-4xl font-display text-[clamp(3.2rem,10vw,7.5rem)] leading-[0.85] font-black uppercase">
            Vos réseaux sociaux passent en <span className="text-signal">pilote automatique.</span>
          </h1>
          <div className="mt-8 grid gap-8 md:grid-cols-[1.3fr_1fr] md:items-end">
            <p className="max-w-xl text-lg text-paper/75">
              Décrivez votre commerce une fois. Le studio rédige vos publications, prépare vos visuels et les publie à
              l&apos;heure prévue, sur chaque réseau, dans le bon format. Vous, vous gardez le cap.
            </p>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Link href="/inscription" className="rounded-full bg-signal px-6 py-3 font-semibold text-ink transition hover:brightness-110">
                Embarquer gratuitement
              </Link>
              <Link href="#boucle" className="rounded-full border border-paper/25 px-6 py-3 font-semibold text-paper transition hover:border-signal hover:text-signal">
                Voir l&apos;itinéraire
              </Link>
            </div>
          </div>
          <p className="mt-4 font-board text-[11px] tracking-[0.18em] text-paper/45 uppercase md:text-right">
            Offre gratuite · sans carte bancaire
          </p>
          <div className="mt-12">
            <DepartureBoard />
          </div>
        </div>
        <div className="hazard h-3" aria-hidden="true" />
      </section>

      {/* ---------- La boucle ---------- */}
      <section id="boucle" className="scroll-mt-28 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle code="Itinéraire · Ligne SM1" title={<>Une ligne,<br />cinq escales.</>}>
            Le studio fait tourner une boucle simple : ce qu&apos;il apprend de vous nourrit ce qu&apos;il publie. Les deux
            dernières escales sont en travaux : elles ouvrent à l&apos;étape suivante.
          </SectionTitle>

          <ol className="relative mt-16 grid gap-10 md:grid-cols-5 md:gap-4">
            {ROUTE.map((stop, index) => (
              <li key={stop.code} className="relative pl-14 md:pt-14 md:pl-0">
                {/* Tronçon de ligne vers l'escale suivante. */}
                {index < ROUTE.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute top-8 left-[15px] h-[calc(100%+2.5rem)] w-[3px] md:top-[15px] md:left-8 md:h-[3px] md:w-[calc(100%+1rem)]",
                      ROUTE[index + 1]?.ready ? "bg-ink" : "route-dashed",
                    )}
                  />
                ) : null}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-0 left-0 grid size-8 place-items-center rounded-full border-[3px]",
                    stop.ready ? "border-ink bg-signal" : "border-dashed border-ink-soft bg-paper",
                  )}
                >
                  <span className={cn("size-2 rounded-full", stop.ready ? "bg-ink" : "bg-ink-soft")} />
                </span>
                <p className={cn("font-display text-6xl leading-none font-black", stop.ready ? "text-ink" : "text-ink/25")}>{stop.code}</p>
                <p className="mt-2 flex items-center gap-2 font-board text-xs tracking-[0.18em] uppercase">
                  {stop.name}
                  {!stop.ready ? <span className="rounded-sm bg-ink px-1.5 py-0.5 text-[10px] text-signal">Bientôt</span> : null}
                </p>
                <p className="mt-3 text-sm text-ink-soft">{stop.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- À bord ---------- */}
      <section className="bg-paper-2 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionTitle code="Équipement de bord" title="Ce qui est à bord." />
            <Link href="/fonctionnalites" className="font-board text-sm tracking-[0.12em] uppercase underline decoration-signal decoration-4 underline-offset-8 hover:text-ink-soft">
              Le détail, cabine par cabine →
            </Link>
          </div>
          <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10 sm:grid-cols-2 lg:grid-cols-3">
            {ON_BOARD.map((item, index) => (
              <li key={item.label} className="group bg-paper p-7 transition hover:bg-night hover:text-paper">
                <p className="font-board text-xs tracking-[0.2em] text-ink-soft group-hover:text-signal">
                  {String(index + 1).padStart(2, "0")} / {String(ON_BOARD.length).padStart(2, "0")}
                </p>
                <h3 className="mt-6 font-display text-3xl font-extrabold uppercase">{item.label}</h3>
                <p className="mt-2 text-sm text-ink-soft group-hover:text-paper/70">{item.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- Destinations ---------- */}
      <section id="destinations" className="tarmac scroll-mt-28 py-20 text-paper sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle tone="dark" code="Portes d'embarquement" title="Huit destinations.">
            Une porte n&apos;ouvre que lorsque nous avons publié avec succès sur un vrai compte. Ce tableau dit où nous en
            sommes, réseau par réseau.
          </SectionTitle>
          <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SOCIAL_NETWORK_IDS.map((id, index) => {
              const network = SOCIAL_NETWORKS[id];
              const status = GATE_STATUS[network.integrationStatus];
              return (
                <li key={id} className="rounded-xl border border-white/10 bg-night-2 p-5">
                  <div className="flex items-center justify-between font-board text-[11px] tracking-[0.2em] text-paper/45">
                    <span>PORTE {String.fromCharCode(65 + Math.floor(index / 4))}{(index % 4) + 1}</span>
                    <span>{network.maxTextLength.toLocaleString("fr-FR")} car.</span>
                  </div>
                  <p className="mt-4 font-display text-3xl font-extrabold uppercase">{network.label}</p>
                  <p className="mt-1 text-xs text-paper/55">
                    {network.allowsTextOnly ? "Texte, images" : "Image ou vidéo obligatoire"}
                    {network.publishableMedia.includes("video") ? " · vidéo prévue" : ""}
                  </p>
                  <span className={cn("mt-5 inline-block rounded-sm px-2 py-1 font-board text-[11px] tracking-[0.14em] uppercase", status.className)}>
                    {status.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ---------- Check-list ---------- */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
          <SectionTitle code="Check-list avant décollage" title={<>Ce que le pilote ne fera <span className="bg-signal px-2">jamais</span>.</>}>
            Un outil qui publie en votre nom doit mériter votre confiance. Voici les règles qu&apos;il suit, et que vous
            pouvez vérifier.
          </SectionTitle>
          <ol className="divide-y divide-ink/10 border-y border-ink/10">
            {NEVER.map((item, index) => (
              <li key={item.title} className="flex gap-5 py-6">
                <span className="font-board text-sm text-ink-soft">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="flex items-start gap-3 font-display text-2xl leading-tight font-extrabold uppercase">
                    <span aria-hidden="true" className="mt-1 grid size-5 shrink-0 place-items-center rounded-sm border-2 border-ink text-xs">
                      ✕
                    </span>
                    {item.title}
                  </h3>
                  <p className="mt-2 text-ink-soft">{item.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Tarifs ---------- */}
      <section className="bg-paper-2 py-20 sm:py-28" style={{ ["--pass-bg" as string]: "var(--color-paper-2)" }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionTitle code="Billetterie" title="Choisissez votre classe.">
              Commencez gratuitement, changez de classe quand vous voulez depuis votre espace.
            </SectionTitle>
            <Link href="/tarifs" className="font-board text-sm tracking-[0.12em] uppercase underline decoration-signal decoration-4 underline-offset-8 hover:text-ink-soft">
              Tarifs et crédits en détail →
            </Link>
          </div>
          <div className="mt-12">
            <PlanTickets plans={plans} />
          </div>
        </div>
      </section>

      {/* ---------- Questions ---------- */}
      <section id="questions" className="scroll-mt-28 py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
          <SectionTitle code="Comptoir information" title="Questions avant le départ." />
          <div className="divide-y divide-ink/10 border-y border-ink/10">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-2xl font-extrabold uppercase">
                  {item.q}
                  <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink transition group-open:rotate-45 group-open:bg-signal">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-ink-soft">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Embarquement ---------- */}
      <section className="tarmac text-paper">
        <div className="hazard h-3" aria-hidden="true" />
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-4 py-20 sm:px-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-board text-xs tracking-[0.25em] text-signal uppercase">Dernier appel</p>
            <h2 className="mt-4 font-display text-[clamp(3rem,8vw,6rem)] leading-[0.85] font-black uppercase">
              Prêt au <span className="text-signal">décollage</span>&nbsp;?
            </h2>
          </div>
          <Link href="/inscription" className="rounded-full bg-signal px-8 py-4 text-lg font-semibold text-ink transition hover:brightness-110">
            Créer mon compte gratuit
          </Link>
        </div>
      </section>
    </>
  );
}

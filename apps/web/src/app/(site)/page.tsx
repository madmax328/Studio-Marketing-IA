import type { Metadata } from "next";
import Link from "next/link";
import { CREDIT_COSTS, SOCIAL_NETWORK_IDS, SOCIAL_NETWORKS, type IntegrationStatus } from "@smia/shared";
import { PersonaDemo } from "@/components/site/persona-demo";
import { PlanCards } from "@/components/site/plan-cards";
import { SectionHeading } from "@/components/site/section-heading";
import { cn } from "@/lib/cn";
import { getPublicPlans } from "@/server/services/public-plans";

export const metadata: Metadata = {
  title: { absolute: "Studio Marketing IA · Vos réseaux sociaux, écrits et publiés pour vous" },
  description:
    "Décrivez votre activité une fois : le studio écrit vos publications, crée vos visuels et les publie à l'heure prévue sur vos réseaux sociaux.",
};

/** Les offres (base + Stripe) sont relues toutes les heures. */
export const revalidate = 3600;

const AUDIENCES = [
  "Indépendants",
  "Associations",
  "Artisans",
  "Coachs",
  "Restaurants",
  "Photographes",
  "Consultants",
  "Créateurs",
  "Boutiques en ligne",
  "Professions libérales",
  "PME",
  "Agences",
  "Clubs sportifs",
  "Collectivités",
];

const STEPS = [
  {
    title: "Présentez votre activité",
    text: "Ce que vous faites, pour qui, votre façon de parler, vos couleurs. Une fois pour toutes : le studio s'en souvient.",
    tone: "bg-mint",
  },
  {
    title: "Relisez les publications",
    text: "Le studio écrit une version adaptée à chaque réseau et prépare les visuels. Vous corrigez ce que vous voulez.",
    tone: "bg-butter",
  },
  {
    title: "Elles partent toutes seules",
    text: "Choisissez le jour et l'heure. La publication part sur le bon compte, et vous êtes prévenu si quelque chose bloque.",
    tone: "bg-lilac",
  },
];

const FOR_WHO = [
  { who: "Indépendants et professions libérales", why: "Être présent en ligne sans y passer ses soirées.", tone: "bg-mint" },
  { who: "Associations et clubs", why: "Annoncer les événements, remercier les bénévoles, garder le lien.", tone: "bg-butter" },
  { who: "Commerces et restaurants", why: "Faire savoir ce qui est nouveau cette semaine, sans y penser chaque jour.", tone: "bg-rose" },
  { who: "Créateurs et formateurs", why: "Publier régulièrement autour de vos contenus et de vos projets.", tone: "bg-sky" },
  { who: "PME", why: "Une communication suivie, cohérente sur tous les réseaux, avec plusieurs marques si besoin.", tone: "bg-lilac" },
  { who: "Agences", why: "Préparer les publications de plusieurs marques, chacune avec sa propre fiche.", tone: "bg-cream-2" },
];

const STATUS: Record<IntegrationStatus, { label: string; className: string }> = {
  available: { label: "Disponible", className: "bg-mint" },
  in_development: { label: "En test", className: "bg-butter" },
  planned: { label: "Bientôt", className: "bg-cream-2 text-ink-soft" },
};

const PROMISES = [
  {
    title: "Rien d'inventé",
    text: "Le studio n'utilise que ce que vous lui avez dit. Il n'invente ni prix, ni promotion, ni coordonnées : s'il manque une information, il vous le signale.",
  },
  {
    title: "Jamais votre mot de passe",
    text: "Vos comptes se connectent par la page officielle de chaque réseau. Vous pouvez retirer l'accès à tout moment.",
  },
  {
    title: "Rien ne part sans vous",
    text: "Une publication ne part que si vous l'avez programmée. Vous pouvez la modifier, la décaler ou l'annuler avant son départ.",
  },
  {
    title: "Vos données restent à vous",
    text: "Export complet en un clic. Suppression définitive du compte et de vos fichiers quand vous le décidez.",
  },
];

/** Réponse construite à partir de l'état réel de chaque intégration (jamais en avance sur la réalité). */
function networksAnswer(): string {
  const byStatus = (status: IntegrationStatus) =>
    SOCIAL_NETWORK_IDS.filter((id) => SOCIAL_NETWORKS[id].integrationStatus === status).map((id) => SOCIAL_NETWORKS[id].label);
  const list = (labels: string[]) => (labels.length > 1 ? `${labels.slice(0, -1).join(", ")} et ${labels.at(-1)}` : (labels[0] ?? ""));
  const parts = [
    byStatus("available").length > 0 ? `Disponibles : ${list(byStatus("available"))}.` : "",
    byStatus("in_development").length > 0 ? `En test sur de vrais comptes : ${list(byStatus("in_development"))}.` : "",
    byStatus("planned").length > 0 ? `Bientôt : ${list(byStatus("planned"))}.` : "",
  ];
  return `${parts.filter(Boolean).join(" ")} Un réseau n'est annoncé disponible qu'après une publication réussie sur un vrai compte.`;
}

const FAQ: { q: string; a: string }[] = [
  {
    q: "Je n'y connais rien aux réseaux sociaux. C'est pour moi ?",
    a: "Oui. Vous décrivez votre activité avec vos mots, le studio s'occupe de la mise en forme pour chaque réseau. Vous gardez la main : chaque publication se relit et se modifie avant de partir.",
  },
  {
    q: "Je ne suis pas une entreprise, ça marche quand même ?",
    a: "Oui : association, club, créateur, profession libérale, collectivité… Le studio s'adapte à ce que vous êtes. Il ne parlera pas de « clients » ou de « produits » si ce n'est pas votre cas.",
  },
  { q: "Sur quels réseaux puis-je publier ?", a: networksAnswer() },
  {
    q: "Qu'est-ce qu'un crédit IA ?",
    a: `C'est ce que consomme l'intelligence artificielle. Écrire des publications dans le studio coûte ${CREDIT_COSTS.text_generation} crédit, préparer la stratégie d'une campagne ${CREDIT_COSTS.campaign_strategy}, écrire un lot de publications de campagne ${CREDIT_COSTS.campaign_posts}. Les visuels et l'envoi des publications ne coûtent rien, et un essai qui échoue est remboursé.`,
  },
  {
    q: "Et les vidéos ?",
    a: "Pas encore : le studio publie aujourd'hui des textes et des images. La création de vidéos est prévue dans une prochaine version.",
  },
  {
    q: "Que deviennent mes données ?",
    a: "Elles restent dans votre espace, séparées de celles des autres utilisateurs. Vous pouvez tout exporter ou supprimer votre compte depuis les paramètres ; un abonnement éventuel est alors résilié automatiquement.",
  },
];

export default async function HomePage() {
  const plans = await getPublicPlans();

  return (
    <>
      {/* ---------- Ouverture ---------- */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 pt-14 pb-16 sm:px-6 sm:pt-20 lg:grid-cols-[1fr_1.25fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-ink bg-butter px-3 py-1 text-sm font-semibold">
              <span aria-hidden="true">✦</span> Pour tous ceux qui ont mieux à faire
            </p>
            <h1 className="mt-6 font-serif text-[clamp(3.2rem,8vw,6.2rem)] leading-[0.9] tracking-tight">
              Vos réseaux sociaux, <em className="text-tomato">écrits et publiés</em> pour vous.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-soft">
              Présentez votre activité une fois. Le studio écrit vos publications, crée vos visuels et les publie à
              l&apos;heure prévue sur vos réseaux. Vous relisez, il s&apos;occupe du reste.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/inscription"
                className="rounded-full border-[1.5px] border-ink bg-tomato px-6 py-3 font-semibold shadow-[3px_3px_0_#17140f] transition hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_#17140f]"
              >
                Créer mon compte gratuit
              </Link>
              <Link href="#comment" className="rounded-full border-[1.5px] border-ink bg-white px-6 py-3 font-semibold hover:bg-cream-2">
                Comment ça marche ?
              </Link>
            </div>
            <p className="mt-4 text-sm text-ink-soft">Offre gratuite, sans carte bancaire.</p>
          </div>
          <PersonaDemo />
        </div>
      </section>

      {/* ---------- Bandeau des publics ---------- */}
      <section aria-label="Pour qui" className="overflow-hidden border-y-[1.5px] border-ink bg-ink py-4 text-cream">
        <div className="marquee" aria-hidden="true">
          {[0, 1].map((copy) => (
            <p key={copy} className="flex shrink-0 items-center font-serif text-3xl whitespace-nowrap italic">
              {AUDIENCES.map((audience) => (
                <span key={audience} className="flex items-center">
                  <span className="px-6">{audience}</span>
                  <span className="text-tomato not-italic">✦</span>
                </span>
              ))}
            </p>
          ))}
        </div>
        <p className="sr-only">Pour les {AUDIENCES.join(", ").toLowerCase()}.</p>
      </section>

      {/* ---------- Comment ça marche ---------- */}
      <section id="comment" className="scroll-mt-28 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading number="01" kicker="Comment ça marche" title={<>Trois étapes, <em>puis plus rien à faire.</em></>} />
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className={cn("sticker p-7", step.tone)}>
                <p className="font-serif text-7xl leading-none">{index + 1}</p>
                <h3 className="mt-6 text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 text-ink-soft">{step.text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 flex flex-wrap items-center gap-3 text-ink-soft">
            <span className="rounded-full border-[1.5px] border-dashed border-ink px-3 py-1 text-sm font-semibold text-ink">Bientôt</span>
            Les résultats de chaque publication et des conseils pour faire mieux la fois suivante.
          </p>
        </div>
      </section>

      {/* ---------- Pour qui ---------- */}
      <section id="pour-qui" className="scroll-mt-28 bg-cream-2 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading number="02" kicker="Pour qui ?" title={<>Pour vous, <em>quelle que soit votre activité.</em></>}>
            Le studio apprend qui vous êtes et écrit comme vous. Une association ne parle pas comme un cabinet de conseil :
            vos publications non plus.
          </SectionHeading>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FOR_WHO.map((item) => (
              <li key={item.who} className="sticker-sm flex items-start gap-4 bg-white p-5">
                <span aria-hidden="true" className={cn("mt-1 size-4 shrink-0 rounded-full border-[1.5px] border-ink", item.tone)} />
                <div>
                  <h3 className="font-semibold">{item.who}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{item.why}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- Fonctionnalités (aperçu) ---------- */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionHeading number="03" kicker="Dans le studio" title={<>Tout ce qu&apos;il faut, <em>rien de compliqué.</em></>} />
            <Link href="/fonctionnalites" className="font-semibold underline decoration-tomato decoration-2 underline-offset-4">
              Voir toutes les fonctionnalités →
            </Link>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            <article className="sticker bg-white p-6 lg:col-span-2">
              <p className="text-sm font-semibold text-ink-soft">Votre fiche</p>
              <h3 className="mt-1 font-serif text-4xl">Une mémoire de votre activité</h3>
              <p className="mt-2 text-ink-soft">Ce que vous proposez, à qui, sur quel ton, avec quels mots : la base de tout ce qui sera écrit.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3" aria-hidden="true">
                {[
                  ["Ton", "Chaleureux"],
                  ["Public", "Familles du quartier"],
                  ["À éviter", "« pas cher »"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border-[1.5px] border-ink bg-cream p-3">
                    <p className="text-xs text-ink-soft">{label}</p>
                    <p className="font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            </article>
            <article className="sticker bg-tomato p-6">
              <p className="text-sm font-semibold">Visuels</p>
              <h3 className="mt-1 font-serif text-4xl">À vos couleurs</h3>
              <p className="mt-2">Modèles prêts à l&apos;emploi avec votre logo, en carré, portrait, vertical ou paysage.</p>
            </article>
            <article className="sticker bg-lilac p-6">
              <p className="text-sm font-semibold">Campagnes</p>
              <h3 className="mt-1 font-serif text-4xl">Un mois prévu d&apos;avance</h3>
              <p className="mt-2 text-ink-soft">Un assistant vous pose les bonnes questions, propose un plan, puis écrit toutes les publications.</p>
            </article>
            <article className="sticker bg-white p-6 lg:col-span-2">
              <p className="text-sm font-semibold text-ink-soft">Calendrier</p>
              <h3 className="mt-1 font-serif text-4xl">Tout ce qui part, d&apos;un coup d&apos;œil</h3>
              <div className="mt-5 grid grid-cols-7 gap-1.5 text-center text-xs" aria-hidden="true">
                {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day, index) => (
                  <div key={day} className="rounded-lg border border-ink/15 bg-cream p-1.5">
                    <p className="text-ink-soft">{day}</p>
                    {index % 2 === 0 ? <span className="mt-1.5 block h-2 rounded-full bg-tomato" /> : null}
                    {index === 3 || index === 4 ? <span className="mt-1 block h-2 rounded-full bg-sky" /> : null}
                    {index === 1 ? <span className="mt-1.5 block h-2 rounded-full bg-mint" /> : null}
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ---------- Réseaux ---------- */}
      <section id="reseaux" className="scroll-mt-28 bg-ink py-20 text-cream sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading tone="light" number="04" kicker="Réseaux" title={<>Huit réseaux, <em>un seul endroit.</em></>}>
            Un réseau n&apos;est annoncé « disponible » qu&apos;après une publication réussie sur un vrai compte. Voici où nous
            en sommes, sans arrondi.
          </SectionHeading>
          <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SOCIAL_NETWORK_IDS.map((id) => {
              const network = SOCIAL_NETWORKS[id];
              const status = STATUS[network.integrationStatus];
              return (
                <li key={id} className="flex items-center justify-between gap-3 rounded-2xl border border-cream/15 p-5">
                  <div>
                    <p className="font-serif text-3xl leading-none">{network.label}</p>
                    <p className="mt-1.5 text-xs text-cream/55">{network.allowsTextOnly ? "Texte et images" : "Image obligatoire"}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full border-[1.5px] border-ink px-2.5 py-0.5 text-xs font-semibold text-ink", status.className)}>
                    {status.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ---------- Engagements ---------- */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading number="05" kicker="Nos engagements" title={<>Publier en votre nom, <em>ça se mérite.</em></>} />
          <ul className="mt-12 grid gap-6 md:grid-cols-2">
            {PROMISES.map((item, index) => (
              <li key={item.title} className="flex gap-5 border-t-[1.5px] border-ink pt-6">
                <span className="font-serif text-5xl leading-none text-tomato italic">{index + 1}</span>
                <div>
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                  <p className="mt-2 text-ink-soft">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- Tarifs ---------- */}
      <section className="bg-cream-2 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionHeading number="06" kicker="Tarifs" title={<>Commencez gratuitement, <em>changez quand vous voulez.</em></>} />
            <Link href="/tarifs" className="font-semibold underline decoration-tomato decoration-2 underline-offset-4">
              Tarifs et crédits en détail →
            </Link>
          </div>
          <div className="mt-12">
            <PlanCards plans={plans} />
          </div>
        </div>
      </section>

      {/* ---------- Questions ---------- */}
      <section id="questions" className="scroll-mt-28 py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
          <SectionHeading number="07" kicker="Questions fréquentes" title={<>Vous vous <em>demandez peut-être…</em></>} />
          <div className="space-y-3">
            {FAQ.map((item) => (
              <details key={item.q} className="group sticker-sm bg-white px-5 py-4 open:bg-butter">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {item.q}
                  <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] border-ink bg-white transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-ink-soft">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Appel final ---------- */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="sticker mx-auto flex max-w-6xl flex-col items-start gap-8 bg-tomato p-8 sm:p-12 md:flex-row md:items-center md:justify-between">
          <h2 className="font-serif text-[clamp(2.6rem,6vw,4.5rem)] leading-[0.95]">
            Votre prochaine publication <em>peut partir demain matin.</em>
          </h2>
          <Link
            href="/inscription"
            className="shrink-0 rounded-full border-[1.5px] border-ink bg-ink px-7 py-3.5 font-semibold text-cream transition hover:bg-white hover:text-ink"
          >
            Créer mon compte gratuit
          </Link>
        </div>
      </section>
    </>
  );
}

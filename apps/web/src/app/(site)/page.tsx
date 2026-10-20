import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CREDIT_COSTS, SOCIAL_NETWORK_IDS, SOCIAL_NETWORKS, type IntegrationStatus } from "@smia/shared";
import { FeatureBento } from "@/components/site/feature-bento";
import { PlanCards } from "@/components/site/plan-cards";
import { ProductDemo } from "@/components/site/product-demo";
import { SectionHeading } from "@/components/site/section-heading";
import { cn } from "@/lib/cn";
import { getPublicPlans } from "@/server/services/public-plans";

export const metadata: Metadata = {
  title: { absolute: "Studio Marketing IA · Vous décrivez, le studio écrit, crée et publie" },
  description:
    "Présentez votre activité une fois : le studio écrit vos publications, crée vos visuels et les publie à l'heure prévue sur vos réseaux sociaux.",
};

/** Les offres (base + Stripe) sont relues toutes les heures. */
export const revalidate = 3600;

const STEPS = [
  { title: "Présentez votre activité", text: "Ce que vous faites, pour qui, votre ton et vos couleurs. Une seule fois : le studio s'en souvient." },
  { title: "Relisez les propositions", text: "Une version pour chaque réseau, avec ses visuels. Vous modifiez ce que vous voulez, en quelques secondes." },
  { title: "Laissez partir", text: "Choisissez le jour et l'heure. Les publications partent seules, et vous êtes prévenu si quelque chose bloque." },
];

const AUDIENCES = [
  { who: "Indépendants et professions libérales", why: "Être visible sans y consacrer ses soirées." },
  { who: "Associations et clubs", why: "Annoncer les événements, mobiliser les bénévoles, garder le lien." },
  { who: "Commerces et restaurants", why: "Faire savoir ce qui est nouveau, chaque semaine, sans y penser." },
  { who: "Créateurs et formateurs", why: "Publier régulièrement autour de vos contenus et de vos projets." },
  { who: "PME", why: "Une communication suivie et cohérente sur tous vos réseaux." },
  { who: "Agences", why: "Préparer les publications de plusieurs marques, chacune avec sa propre fiche." },
];

const STATUS: Record<IntegrationStatus, { label: string; className: string }> = {
  available: { label: "Disponible", className: "bg-ok/10 text-ok" },
  in_development: { label: "En test", className: "bg-gold/10 text-gold" },
  planned: { label: "Bientôt", className: "bg-white/5 text-fg-dim" },
};

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
);

const PROMISES = [
  {
    title: "Rien d'inventé",
    text: "Le studio n'utilise que ce que vous lui avez dit : ni prix, ni promotion, ni coordonnées inventés. S'il manque une information, il vous le signale.",
    icon: icon(<path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3zM9 12l2 2 4-4" />),
  },
  {
    title: "Jamais votre mot de passe",
    text: "Vos comptes se connectent par la page officielle de chaque réseau. Vous retirez l'accès quand vous voulez.",
    icon: icon(<path d="M7 11V8a5 5 0 0110 0v3M5 11h14v10H5zM12 15v2" />),
  },
  {
    title: "Rien ne part sans vous",
    text: "Une publication ne part que si vous l'avez programmée. Modifiable, décalable ou annulable jusqu'à son départ.",
    icon: icon(<path d="M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z" />),
  },
  {
    title: "Vos données vous appartiennent",
    text: "Export complet en un clic. Suppression définitive du compte et de vos fichiers quand vous le décidez.",
    icon: icon(<path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />),
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
    a: "Oui. Vous décrivez votre activité avec vos mots, le studio s'occupe de la mise en forme pour chaque réseau. Chaque publication se relit et se modifie avant de partir.",
  },
  {
    q: "Je ne suis pas une entreprise. Ça marche quand même ?",
    a: "Oui : association, club, créateur, profession libérale, collectivité… Le studio s'adapte à ce que vous êtes et ne parle pas de « clients » ou de « produits » si ce n'est pas votre cas.",
  },
  { q: "Sur quels réseaux puis-je publier ?", a: networksAnswer() },
  {
    q: "Qu'est-ce qu'un crédit IA ?",
    a: `C'est ce que consomme l'intelligence artificielle. Écrire des publications coûte ${CREDIT_COSTS.text_generation} crédit, préparer le plan d'une campagne ${CREDIT_COSTS.campaign_strategy}, écrire un lot de publications de campagne ${CREDIT_COSTS.campaign_posts}. Les visuels et l'envoi ne coûtent rien, et un essai qui échoue est remboursé.`,
  },
  { q: "Et les vidéos ?", a: "Pas encore : le studio publie aujourd'hui des textes et des images. La création de vidéos est prévue dans une prochaine version." },
  {
    q: "Que deviennent mes données ?",
    a: "Elles restent dans votre espace, séparées de celles des autres utilisateurs. Vous pouvez tout exporter ou supprimer votre compte depuis les paramètres ; un abonnement éventuel est alors résilié automatiquement.",
  },
];

function PrimaryButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-full bg-fg px-6 py-3 text-sm font-medium text-void shadow-[0_0_0_1px_rgb(255_255_255/0.1),0_8px_30px_-8px_rgb(255_122_69/0.6)] transition hover:bg-white">
      {children}
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
        <path d="M3 8h10m-4-4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}

export default async function HomePage() {
  const plans = await getPublicPlans();

  return (
    <>
      {/* ---------- Ouverture ---------- */}
      <section className="relative overflow-x-clip">
        <div aria-hidden="true" className="halo pointer-events-none absolute inset-x-0 -top-16 h-[44rem]" />
        <div aria-hidden="true" className="grid-fade pointer-events-none absolute inset-x-0 -top-16 h-[44rem]" />
        <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-fg-muted">
              <span className="size-1.5 rounded-full bg-solar" aria-hidden="true" />
              Pour les indépendants, associations, créateurs et entreprises
            </p>
            <h1 className="mt-7 text-[clamp(2.6rem,7vw,5.25rem)] leading-[1.02] font-semibold tracking-[-0.045em] text-balance">
              Vous décrivez.
              <br />
              <span className="text-sun">Le studio écrit, crée et publie.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-pretty text-fg-muted">
              Présentez votre activité une fois. Vos publications sont écrites pour chaque réseau, illustrées à vos
              couleurs et publiées à l&apos;heure prévue. Vous relisez, c&apos;est tout.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <PrimaryButton href="/inscription">Créer mon compte gratuit</PrimaryButton>
              <Link href="#comment" className="rounded-full px-5 py-3 text-sm font-medium text-fg-muted transition hover:text-fg">
                Comment ça marche ?
              </Link>
            </div>
            <p className="mt-4 text-xs text-fg-dim">Offre gratuite · sans carte bancaire</p>
          </div>
          <div className="relative mt-16">
            <div aria-hidden="true" className="absolute -inset-x-10 -top-10 bottom-0 rounded-[3rem] bg-gradient-to-b from-solar/10 to-transparent blur-3xl" />
            <div className="relative">
              <ProductDemo />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Comment ça marche ---------- */}
      <section id="comment" className="scroll-mt-20 border-t border-line py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Comment ça marche" title="Trois étapes. Ensuite, plus rien à faire." />
          <ol className="relative mt-14 grid gap-4 md:grid-cols-3">
            <span aria-hidden="true" className="absolute top-[2.15rem] right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-solar/0 via-solar/50 to-solar/0 md:block" />
            {STEPS.map((step, index) => (
              <li key={step.title} className="glass relative rounded-2xl p-6">
                <span className="relative grid size-9 place-items-center rounded-full border border-line-strong bg-void font-mono text-xs text-solar">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-6 text-lg font-medium tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{step.text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 flex flex-wrap items-center gap-3 text-sm text-fg-muted">
            <span className="rounded-full border border-line-strong px-2.5 py-0.5 font-mono text-[11px] tracking-wide uppercase">Et ensuite</span>
            Les chiffres réels de chaque publication remontent dans vos statistiques, et le studio s&apos;inspire de ce qui a le
            mieux marché pour écrire les suivantes.
          </p>
        </div>
      </section>

      {/* ---------- Fonctionnalités ---------- */}
      <section className="border-t border-line py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionHeading eyebrow="Fonctionnalités" title="Tout ce qu'il faut. Rien de compliqué." />
            <Link href="/fonctionnalites" className="shrink-0 text-sm text-fg-muted transition hover:text-fg">
              Voir le détail →
            </Link>
          </div>
          <div className="mt-14">
            <FeatureBento />
          </div>
        </div>
      </section>

      {/* ---------- Pour qui ---------- */}
      <section id="pour-qui" className="scroll-mt-20 border-t border-line py-24 sm:py-32">
        <div className="mx-auto grid max-w-6xl gap-14 px-4 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
          <SectionHeading eyebrow="Pour qui ?" title="Pour vous, quelle que soit votre activité.">
            Le studio apprend qui vous êtes et écrit comme vous. Une association ne parle pas comme un cabinet de conseil :
            vos publications non plus.
          </SectionHeading>
          <ul className="divide-y divide-line border-y border-line">
            {AUDIENCES.map((item) => (
              <li key={item.who} className="group flex items-baseline justify-between gap-6 py-5">
                <span className="font-medium tracking-tight transition group-hover:text-gold">{item.who}</span>
                <span className="max-w-xs text-right text-sm text-fg-muted">{item.why}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- Réseaux ---------- */}
      <section id="reseaux" className="scroll-mt-20 border-t border-line py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Réseaux" title="Huit réseaux, un seul endroit.">
            Un réseau n&apos;est annoncé disponible qu&apos;après une publication réussie sur un vrai compte. Voici où nous en
            sommes, sans arrondi.
          </SectionHeading>
          <ul className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {SOCIAL_NETWORK_IDS.map((id) => {
              const network = SOCIAL_NETWORKS[id];
              const status = STATUS[network.integrationStatus];
              return (
                <li key={id} className="flex flex-col justify-between gap-6 bg-deep p-6">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-lg font-medium tracking-tight">{network.label}</p>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs", status.className)}>{status.label}</span>
                  </div>
                  <p className="font-mono text-[11px] text-fg-dim">
                    {network.allowsTextOnly ? "Texte et images" : "Image obligatoire"} · {network.maxTextLength.toLocaleString("fr-FR")} car.
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ---------- Engagements ---------- */}
      <section className="border-t border-line py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Nos engagements" title="Publier en votre nom, ça se mérite." />
          <ul className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {PROMISES.map((item) => (
              <li key={item.title}>
                <span className="grid size-10 place-items-center rounded-xl border border-line-strong bg-white/[0.03] text-gold">{item.icon}</span>
                <h3 className="mt-5 font-medium tracking-tight">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{item.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- Tarifs ---------- */}
      <section className="border-t border-line py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Tarifs" title="Gratuit pour commencer. Simple ensuite." align="center">
            Changez d&apos;offre quand vous voulez, depuis votre espace.
          </SectionHeading>
          <div className="mt-14">
            <PlanCards plans={plans} />
          </div>
          <p className="mt-8 text-center text-sm">
            <Link href="/tarifs" className="text-fg-muted transition hover:text-fg">
              Tout savoir sur les crédits et le paiement →
            </Link>
          </p>
        </div>
      </section>

      {/* ---------- Questions ---------- */}
      <section id="questions" className="scroll-mt-20 border-t border-line py-24 sm:py-32">
        <div className="mx-auto grid max-w-6xl gap-14 px-4 sm:px-6 lg:grid-cols-[1fr_1.5fr]">
          <SectionHeading eyebrow="Questions fréquentes" title="Vous vous demandez peut-être…" />
          <div className="divide-y divide-line border-y border-line">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-medium tracking-tight">
                  {item.q}
                  <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full border border-line-strong text-fg-muted transition group-open:rotate-45 group-open:text-solar">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Appel final ---------- */}
      <section className="px-4 pb-24 sm:px-6">
        <div className="glass relative mx-auto max-w-6xl overflow-hidden rounded-3xl px-6 py-20 text-center sm:px-12">
          <div aria-hidden="true" className="halo pointer-events-none absolute inset-0" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
              Votre prochaine publication peut partir <span className="text-sun">demain matin.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-md text-fg-muted">Créez votre compte, présentez votre activité, et laissez le studio s&apos;occuper du reste.</p>
            <div className="mt-9 flex justify-center">
              <PrimaryButton href="/inscription">Créer mon compte gratuit</PrimaryButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { CREDIT_COSTS } from "@smia/shared";
import { PlanCards } from "@/components/site/plan-cards";
import { imageAiAvailable } from "@/lib/features";
import { SectionHeading } from "@/components/site/section-heading";
import { getPublicPlans } from "@/server/services/public-plans";

export const metadata: Metadata = {
  title: "Tarifs",
  description: "Une offre gratuite pour découvrir, des offres payantes pour publier davantage. Les crédits IA expliqués simplement.",
};

/** Offres relues toutes les heures (base + Stripe). */
export const revalidate = 3600;

const COSTS: { label: string; cost: number }[] = [
  { label: "Écrire des publications dans le studio (toutes les versions demandées)", cost: CREDIT_COSTS.text_generation },
  { label: "Proposer le plan d'une campagne", cost: CREDIT_COSTS.campaign_strategy },
  { label: "Écrire un lot de publications de campagne", cost: CREDIT_COSTS.campaign_posts },
  { label: "Réécrire une publication de campagne", cost: CREDIT_COSTS.campaign_post_regeneration },
  ...(imageAiAvailable() ? [{ label: "Créer une image par IA", cost: CREDIT_COSTS.image_generation }] : []),
];

const FREE = ["Créer un visuel avec un modèle", "Programmer et publier", "Modifier un texte vous-même", "Un essai de l'IA qui échoue (remboursé)"];

const QUESTIONS = [
  {
    q: "Comment passer à une offre payante ?",
    a: "Créez votre compte gratuit, puis choisissez votre offre dans « Abonnement ». Le paiement passe par Stripe : nous ne voyons jamais votre carte.",
  },
  {
    q: "Puis-je arrêter quand je veux ?",
    a: "Oui. Vous résiliez depuis « Abonnement » ; votre offre reste active jusqu'à la fin de la période payée, puis vous repassez sur l'offre gratuite.",
  },
  {
    q: "Les crédits non utilisés sont-ils reportés ?",
    a: "Non : chaque mois commence avec les crédits de votre offre. Votre solde et l'historique de vos consommations sont visibles à tout moment.",
  },
  {
    q: "Que se passe-t-il si je n'ai plus de crédits ?",
    a: "L'IA attend le mois suivant ou un changement d'offre. Tout le reste continue : vos publications programmées partent normalement.",
  },
];

export default async function PricingPage() {
  const plans = await getPublicPlans();
  return (
    <>
      <section className="relative overflow-x-clip">
        <div aria-hidden="true" className="halo pointer-events-none absolute inset-x-0 -top-16 h-[30rem]" />
        <div aria-hidden="true" className="grid-fade pointer-events-none absolute inset-x-0 -top-16 h-[30rem]" />
        <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs tracking-[0.14em] text-solar uppercase">Tarifs</p>
            <h1 className="mt-4 text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.03] font-semibold tracking-[-0.045em] text-balance">
              Simple, <span className="text-sun">et sans surprise.</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-fg-muted">
              Commencez gratuitement, sans carte bancaire. Les prix affichés viennent directement de notre système de
              paiement : ce que vous lisez ici est ce que vous paierez.
            </p>
          </div>
          <div className="mt-14">
            <PlanCards plans={plans} />
          </div>
        </div>
      </section>

      <section className="border-t border-line py-24 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-14 px-4 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
          <SectionHeading eyebrow="Crédits IA" title="Ce qui consomme, et ce qui est gratuit.">
            Seule l&apos;intelligence artificielle consomme des crédits. Chaque mouvement est noté dans un historique que vous
            pouvez consulter.
          </SectionHeading>
          <div className="space-y-8">
            <div className="glass overflow-hidden rounded-2xl">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">Coût en crédits de chaque opération</caption>
                <thead>
                  <tr className="border-b border-line text-fg-muted">
                    <th scope="col" className="px-5 py-3.5 font-medium">Ce que fait l&apos;IA</th>
                    <th scope="col" className="px-5 py-3.5 text-right font-medium">Crédits</th>
                  </tr>
                </thead>
                <tbody>
                  {COSTS.map((row) => (
                    <tr key={row.label} className="border-b border-line last:border-0">
                      <td className="px-5 py-4">{row.label}</td>
                      <td className="px-5 py-4 text-right font-mono text-lg text-gold">{row.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <p className="text-sm font-medium">Gratuit, sans limite de crédits</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {FREE.map((item) => (
                  <li key={item} className="rounded-full border border-line-strong px-3 py-1.5 text-sm text-fg-muted">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-line py-24 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-14 px-4 sm:px-6 lg:grid-cols-[1fr_1.5fr]">
          <SectionHeading eyebrow="Paiement et abonnement" title="Bon à savoir." />
          <div className="divide-y divide-line border-y border-line">
            {QUESTIONS.map((item) => (
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

      <section className="px-4 pb-24 sm:px-6">
        <div className="glass relative mx-auto max-w-6xl overflow-hidden rounded-3xl px-6 py-16 text-center">
          <div aria-hidden="true" className="halo pointer-events-none absolute inset-0" />
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Gratuit pour commencer, vraiment.</h2>
            <Link href="/inscription" className="mt-8 inline-block rounded-full bg-fg px-6 py-3 text-sm font-medium text-void hover:bg-white">
              Créer mon compte gratuit
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { CREDIT_COSTS } from "@smia/shared";
import { PlanTickets } from "@/components/site/plan-tickets";
import { SectionTitle } from "@/components/site/section-title";
import { getPublicPlans } from "@/server/services/public-plans";

export const metadata: Metadata = {
  title: "Tarifs",
  description: "Une offre gratuite pour découvrir, des offres payantes pour publier davantage. Crédits IA expliqués simplement.",
};

/** Offres relues toutes les heures (base + Stripe). */
export const revalidate = 3600;

const COSTS: { label: string; cost: number }[] = [
  { label: "Générer des publications dans le studio (toutes les variantes demandées)", cost: CREDIT_COSTS.text_generation },
  { label: "Proposer la stratégie d'une campagne", cost: CREDIT_COSTS.campaign_strategy },
  { label: "Rédiger un lot de publications de campagne", cost: CREDIT_COSTS.campaign_posts },
  { label: "Réécrire une publication de campagne", cost: CREDIT_COSTS.campaign_post_regeneration },
];

const FREE = ["Créer un visuel avec un gabarit", "Programmer et publier", "Modifier un texte à la main", "Un appel à l'IA qui échoue (remboursé)"];

const QUESTIONS = [
  {
    q: "Comment passer à une offre payante ?",
    a: "Créez votre compte gratuit, puis choisissez votre offre dans « Abonnement ». Le paiement est géré par Stripe : nous ne voyons jamais votre carte.",
  },
  {
    q: "Puis-je arrêter quand je veux ?",
    a: "Oui. La résiliation se fait depuis « Abonnement » ; votre offre reste active jusqu'à la fin de la période payée, puis vous repassez sur l'offre gratuite.",
  },
  {
    q: "Les crédits non utilisés sont-ils reportés ?",
    a: "Non : chaque mois commence avec le nombre de crédits de votre offre. Le solde et l'historique de vos consommations sont visibles à tout moment.",
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
      <section className="tarmac text-paper">
        <div className="mx-auto max-w-6xl px-4 pt-16 pb-16 sm:px-6 sm:pt-24">
          <SectionTitle tone="dark" code="Billetterie" title={<>Une classe pour<br />chaque trajet.</>}>
            Commencez gratuitement, sans carte bancaire. Les prix affichés viennent directement de notre système de
            paiement : ce que vous lisez ici est ce que vous paierez.
          </SectionTitle>
        </div>
        <div className="hazard h-3" aria-hidden="true" />
      </section>

      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <PlanTickets plans={plans} />
        </div>
      </section>

      <section className="bg-paper-2 py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
          <SectionTitle code="Carburant" title="Les crédits IA, en clair.">
            Seuls les appels à l&apos;intelligence artificielle consomment des crédits. Chaque mouvement est inscrit dans un
            journal que vous pouvez consulter.
          </SectionTitle>
          <div className="space-y-8">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Coût en crédits de chaque opération</caption>
              <thead>
                <tr className="border-b-2 border-ink font-board text-[11px] tracking-[0.18em] uppercase">
                  <th scope="col" className="py-3">Opération</th>
                  <th scope="col" className="py-3 text-right">Crédits</th>
                </tr>
              </thead>
              <tbody>
                {COSTS.map((row) => (
                  <tr key={row.label} className="border-b border-ink/10">
                    <td className="py-4 pr-4">{row.label}</td>
                    <td className="py-4 text-right font-display text-3xl font-black">{row.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div>
              <p className="font-board text-[11px] tracking-[0.18em] text-ink-soft uppercase">Ne consomme rien</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {FREE.map((item) => (
                  <li key={item} className="rounded-full border-2 border-ink px-3 py-1 text-sm">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
          <SectionTitle code="Comptoir information" title="Paiement et abonnement." />
          <div className="divide-y divide-ink/10 border-y border-ink/10">
            {QUESTIONS.map((item) => (
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

      <section className="bg-night py-14 text-paper">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p className="font-display text-4xl leading-none font-black uppercase">
            Embarquement immédiat, <span className="text-signal">classe découverte</span>.
          </p>
          <Link href="/inscription" className="rounded-full bg-signal px-6 py-3 font-semibold text-ink hover:brightness-110">
            Créer mon compte gratuit
          </Link>
        </div>
      </section>
    </>
  );
}

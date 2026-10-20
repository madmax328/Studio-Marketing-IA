import type { Metadata } from "next";
import Link from "next/link";
import { CREDIT_COSTS } from "@smia/shared";
import { PlanCards } from "@/components/site/plan-cards";
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
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24">
        <SectionHeading kicker="Tarifs" title={<>Simple, <em>et sans surprise.</em></>}>
          Commencez gratuitement, sans carte bancaire. Les prix affichés viennent directement de notre système de
          paiement : ce que vous lisez ici est ce que vous paierez.
        </SectionHeading>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <PlanCards plans={plans} />
        </div>
      </section>

      <section className="bg-cream-2 py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
          <SectionHeading kicker="Crédits IA" title={<>Ce qui consomme, <em>et ce qui est gratuit.</em></>}>
            Seule l&apos;intelligence artificielle consomme des crédits. Chaque mouvement est noté dans un historique que vous
            pouvez consulter.
          </SectionHeading>
          <div className="space-y-8">
            <div className="sticker overflow-hidden bg-white">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Coût en crédits de chaque opération</caption>
                <thead>
                  <tr className="border-b-[1.5px] border-ink bg-butter text-sm">
                    <th scope="col" className="px-5 py-3 font-semibold">Ce que fait l&apos;IA</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Crédits</th>
                  </tr>
                </thead>
                <tbody>
                  {COSTS.map((row) => (
                    <tr key={row.label} className="border-b border-ink/10 last:border-0">
                      <td className="px-5 py-4">{row.label}</td>
                      <td className="px-5 py-4 text-right font-serif text-4xl leading-none">{row.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <p className="font-semibold">Gratuit, sans limite de crédits :</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {FREE.map((item) => (
                  <li key={item} className="rounded-full border-[1.5px] border-ink bg-mint px-3 py-1 text-sm">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
          <SectionHeading kicker="Paiement et abonnement" title={<>Bon <em>à savoir.</em></>} />
          <div className="space-y-3">
            {QUESTIONS.map((item) => (
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

      <section className="px-4 pb-20 sm:px-6">
        <div className="sticker mx-auto flex max-w-6xl flex-col items-start gap-6 bg-tomato p-8 md:flex-row md:items-center md:justify-between">
          <p className="font-serif text-4xl leading-none">
            Gratuit pour commencer, <em>vraiment.</em>
          </p>
          <Link href="/inscription" className="rounded-full border-[1.5px] border-ink bg-ink px-6 py-3 font-semibold text-cream hover:bg-white hover:text-ink">
            Créer mon compte gratuit
          </Link>
        </div>
      </section>
    </>
  );
}

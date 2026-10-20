import Link from "next/link";
import { cn } from "@/lib/cn";
import type { PublicPlan } from "@/server/services/public-plans";

const TONES = ["bg-cream-2", "bg-mint", "bg-butter", "bg-lilac"];

/** Offres du site public : textes et limites lus en base, prix lu chez Stripe. */
export function PlanCards({ plans }: { plans: PublicPlan[] | null }) {
  if (!plans || plans.length === 0) {
    return (
      <p className="sticker-sm bg-white p-6 text-ink-soft">
        Les offres s&apos;affichent ici dès que le studio est en ligne.{" "}
        <Link href="/inscription" className="font-semibold text-ink underline">
          Créer un compte gratuit
        </Link>
      </p>
    );
  }
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {plans.map((plan, index) => (
        <article key={plan.id} className="sticker flex flex-col overflow-hidden bg-white">
          <div className={cn("border-b-[1.5px] border-ink p-5", TONES[index % TONES.length])}>
            <h3 className="font-serif text-4xl leading-none">{plan.name}</h3>
            <p className="mt-2 text-sm text-ink-soft">{plan.description}</p>
          </div>
          <div className="flex flex-1 flex-col gap-5 p-5">
            <p className="text-2xl font-semibold">{plan.price ?? <span className="text-base font-normal text-ink-soft">Prix bientôt annoncé</span>}</p>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Marques", plan.limits.maxBrands],
                ["Crédits IA / mois", plan.limits.monthlyCredits],
                ["Comptes sociaux", plan.limits.maxSocialAccounts],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col-reverse rounded-xl bg-cream-2 px-1 py-2">
                  <dt className="text-[11px] leading-tight text-ink-soft">{label}</dt>
                  <dd className="text-xl font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <ul className="flex-1 space-y-2 text-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <span aria-hidden="true" className="text-tomato">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              href="/inscription"
              className="rounded-full border-[1.5px] border-ink bg-ink px-4 py-2.5 text-center text-sm font-semibold text-cream transition hover:bg-white hover:text-ink"
            >
              {plan.id === "free" ? "Créer mon compte gratuit" : "Commencer"}
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

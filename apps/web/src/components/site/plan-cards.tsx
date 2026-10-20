import Link from "next/link";
import { cn } from "@/lib/cn";
import type { PublicPlan } from "@/server/services/public-plans";

/** Offres du site public : textes et limites lus en base, prix lu chez Stripe. */
export function PlanCards({ plans }: { plans: PublicPlan[] | null }) {
  if (!plans || plans.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-fg-muted">
        Les offres s&apos;affichent ici dès que le studio est en ligne.{" "}
        <Link href="/inscription" className="font-medium text-fg underline underline-offset-4">
          Créer un compte gratuit
        </Link>
      </div>
    );
  }
  // L'offre mise en avant est la première offre payante (choix éditorial, pas une statistique).
  const featured = plans.find((plan) => plan.id !== "free")?.id;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {plans.map((plan) => {
        const highlighted = plan.id === featured;
        return (
          <article
            key={plan.id}
            className={cn("flex flex-col rounded-2xl p-6", highlighted ? "ring-sun bg-gradient-to-b from-solar/[0.09] to-transparent" : "glass")}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">{plan.name}</h3>
              {highlighted ? <span className="rounded-full bg-solar/15 px-2.5 py-0.5 text-xs text-gold">Pour démarrer</span> : null}
            </div>
            <p className="mt-2 min-h-[2.75rem] text-sm leading-relaxed text-fg-muted">{plan.description}</p>
            <p className="mt-6 text-3xl font-semibold tracking-tight">
              {plan.price ?? <span className="text-base font-normal text-fg-muted">Prix bientôt annoncé</span>}
            </p>
            <Link
              href="/inscription"
              className={cn(
                "mt-6 rounded-full px-4 py-2.5 text-center text-sm font-medium transition",
                highlighted ? "bg-fg text-void hover:bg-white" : "border border-line-strong text-fg hover:bg-white/5",
              )}
            >
              {plan.id === "free" ? "Créer mon compte gratuit" : "Commencer"}
            </Link>
            <dl className="mt-6 space-y-2 border-t border-line pt-6 text-sm">
              {[
                ["Marques", plan.limits.maxBrands],
                ["Crédits IA par mois", plan.limits.monthlyCredits],
                ["Comptes sociaux", plan.limits.maxSocialAccounts],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-fg-muted">{label}</dt>
                  <dd className="font-mono">{value}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-6 space-y-2.5 text-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2.5">
                  <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 text-solar" aria-hidden="true">
                    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-fg/90">{feature}</span>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}

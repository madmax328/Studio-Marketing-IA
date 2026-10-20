import Link from "next/link";
import type { PublicPlan } from "@/server/services/public-plans";
import { BoardingPass, PassField } from "./boarding-pass";

const CLASS_CODES: Record<string, string> = { free: "DÉCOUVERTE", solo: "SOLO", business: "AFFAIRES", agency: "AGENCE" };

/** Offres présentées en cartes d'embarquement. Limites et textes viennent de la base, prix de Stripe. */
export function PlanTickets({ plans }: { plans: PublicPlan[] | null }) {
  if (!plans || plans.length === 0) {
    return (
      <p className="rounded-2xl border border-ink/10 bg-paper-2 p-6 text-sm text-ink-soft">
        Les offres s&apos;affichent ici dès que le studio est en ligne.{" "}
        <Link href="/inscription" className="font-semibold text-ink underline">
          Créer un compte gratuit
        </Link>
      </p>
    );
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {plans.map((plan, index) => (
        <BoardingPass
          key={plan.id}
          stub={
            <>
              <PassField label="Prix" value={plan.price ?? "Bientôt"} />
              <div className="grid grid-cols-3 gap-2 md:grid-cols-1">
                <PassField label="Marques" value={plan.limits.maxBrands} />
                <PassField label="Crédits IA / mois" value={plan.limits.monthlyCredits} />
                <PassField label="Comptes sociaux" value={plan.limits.maxSocialAccounts} />
              </div>
              <Link
                href="/inscription"
                className="rounded-full bg-ink px-4 py-2 text-center text-sm font-semibold text-paper transition hover:bg-night-3"
              >
                {plan.id === "free" ? "Embarquer" : "Commencer"}
              </Link>
            </>
          }
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-board text-[10px] tracking-[0.2em] text-ink-soft uppercase">Classe</p>
              <h3 className="font-display text-5xl leading-none font-black uppercase">{plan.name}</h3>
            </div>
            <span className="shrink-0 text-right font-board text-xs tracking-[0.15em] whitespace-nowrap text-ink-soft">
              VOL SM{String(index + 1).padStart(2, "0")}
              <span className="block">{CLASS_CODES[plan.id] ?? plan.id.toUpperCase()}</span>
            </span>
          </div>
          <p className="mt-3 text-ink-soft">{plan.description}</p>
          <ul className="mt-5 space-y-2 text-sm">
            {plan.features.map((feature) => (
              <li key={feature} className="flex gap-2">
                <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rotate-45 bg-signal" />
                {feature}
              </li>
            ))}
          </ul>
        </BoardingPass>
      ))}
    </div>
  );
}

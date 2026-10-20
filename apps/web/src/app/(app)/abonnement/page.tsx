import type { Metadata } from "next";
import { roleHasPermission } from "@smia/shared";
import { CheckoutButton, PortalButton } from "@/components/billing/billing-buttons";
import { Alert, Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { isStripeConfigured, priceIdsByPlan, priceLabel } from "@/server/billing/stripe";
import { getDb } from "@/server/db/client";
import { getCreditAccount, getEffectivePlan, listCreditTransactions, listPlans, remainingCredits } from "@/server/services/billing";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Abonnement" };

const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  trialing: "Période d'essai",
  past_due: "Paiement en retard",
  unpaid: "Impayé",
  canceled: "Résilié",
  incomplete: "Paiement non finalisé",
  incomplete_expired: "Paiement expiré",
  paused: "En pause",
};

const OPERATION_LABELS: Record<string, string> = {
  text_generation: "Génération de publications",
  campaign_strategy: "Stratégie de campagne",
  campaign_posts: "Rédaction de campagne",
  campaign_post_regeneration: "Régénération d'une publication",
};

export default async function BillingPage({ searchParams }: PageProps<"/abonnement">) {
  const { paiement } = await searchParams;
  const access = await requireWorkspace();
  const db = getDb();
  const [plans, effective, account, transactions] = await Promise.all([
    listPlans(db),
    getEffectivePlan(db, access.workspace),
    getCreditAccount(db, access.workspace),
    listCreditTransactions(db, access, 30),
  ]);
  const stripeReady = isStripeConfigured();
  const priceIds = priceIdsByPlan();
  const prices = Object.fromEntries(
    await Promise.all(
      plans.map(async (plan) => [plan._id, stripeReady && priceIds[plan._id] ? await priceLabel(priceIds[plan._id] as string) : null] as const),
    ),
  );
  const canManage = roleHasPermission(access.role, "billing:manage");
  const subscription = effective.subscription;
  const hasPaidSubscription = effective.planId !== "free";
  const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });
  const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">Abonnement</h1>

      {paiement === "ok" ? (
        <Alert tone="success">
          Paiement reçu. Votre offre est activée dès que Stripe nous confirme le paiement (en général quelques secondes) :
          rechargez la page si elle n&apos;apparaît pas encore.
        </Alert>
      ) : null}
      {paiement === "annule" ? <Alert>Paiement annulé : aucun montant n&apos;a été prélevé.</Alert> : null}
      {!stripeReady ? <Alert>Le paiement en ligne n&apos;est pas encore activé : seule l&apos;offre gratuite est disponible.</Alert> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-2">
          <h2 className="font-semibold">Votre offre : {effective.plan?.name ?? "Gratuit"}</h2>
          {subscription?.stripeSubscriptionId ? (
            <p className="text-sm text-muted">
              Statut : {STATUS_LABELS[subscription.status] ?? subscription.status}
              {subscription.currentPeriodEnd
                ? subscription.cancelAtPeriodEnd
                  ? ` · se termine le ${date.format(subscription.currentPeriodEnd)}`
                  : ` · renouvellement le ${date.format(subscription.currentPeriodEnd)}`
                : ""}
            </p>
          ) : null}
          {subscription?.status === "past_due" ? (
            <Alert tone="error">Le dernier paiement a échoué : mettez à jour votre moyen de paiement.</Alert>
          ) : null}
          <ul className="text-sm text-muted">
            <li>Marques : {effective.limits.maxBrands}</li>
            <li>Comptes de réseaux sociaux : {effective.limits.maxSocialAccounts}</li>
            <li>Crédits IA par mois : {effective.limits.monthlyCredits}</li>
          </ul>
          {canManage && stripeReady && subscription?.stripeCustomerId ? <PortalButton /> : null}
        </Card>

        <Card className="space-y-2">
          <h2 className="font-semibold">Crédits de ce mois</h2>
          <p className="text-3xl font-semibold">
            {remainingCredits(account)} <span className="text-base font-normal text-muted">/ {account.allowance}</span>
          </p>
          <p className="text-xs text-muted">
            Renouvelés le 1er de chaque mois. Les crédits servent aux générations par IA ; les visuels par gabarit, la
            programmation et la publication sont gratuits. Une génération qui échoue est remboursée.
          </p>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Les offres</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const current = plan._id === effective.planId;
            const price = prices[plan._id];
            return (
              <Card key={plan._id} className={cn("flex flex-col gap-3", current && "border-primary ring-1 ring-primary")}>
                <div>
                  <p className="font-semibold">{plan.name}</p>
                  <p className="text-sm text-muted">{plan.description}</p>
                </div>
                <p className="text-lg font-semibold">
                  {plan._id === "free" ? "Gratuit" : price ?? <span className="text-sm font-normal text-muted">Tarif bientôt disponible</span>}
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                  <li>{plan.limits.monthlyCredits} crédits IA / mois</li>
                </ul>
                <div className="mt-auto">
                  {current ? (
                    <p className="text-sm font-medium text-primary">Offre actuelle</p>
                  ) : plan._id === "free" ? null : !canManage ? (
                    <p className="text-xs text-muted">Seul le propriétaire de l&apos;espace peut changer d&apos;offre.</p>
                  ) : hasPaidSubscription ? (
                    <p className="text-xs text-muted">Changez d&apos;offre via « Gérer mon abonnement ».</p>
                  ) : stripeReady && priceIds[plan._id] ? (
                    <CheckoutButton planId={plan._id} label={`Choisir ${plan.name}`} />
                  ) : (
                    <button type="button" disabled className="w-full rounded-lg border border-border px-3 py-2 text-sm opacity-50">
                      Bientôt disponible
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <Card className="space-y-2">
        <h2 className="font-semibold">Historique des crédits</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted">Aucun mouvement pour le moment.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {transactions.map((t) => (
              <li key={t._id.toHexString()} className="flex justify-between py-1.5">
                <span>
                  {dateTime.format(t.createdAt)} · {OPERATION_LABELS[t.operation] ?? t.operation}
                  {t.kind === "refund" ? " (remboursement)" : ""}
                </span>
                <span className={t.amount < 0 ? "text-danger" : "text-success"}>
                  {t.amount > 0 ? "+" : ""}
                  {t.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

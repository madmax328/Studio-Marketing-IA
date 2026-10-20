import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MIN_TESTIMONIALS_ON_SITE } from "@smia/shared";
import { ReviewButtons } from "@/components/testimonials/review-buttons";
import { Alert, Card } from "@/components/ui/card";
import { getDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import { isAdminEmail, listTestimonialsForReview } from "@/server/services/testimonials";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Validation des avis" };

const STATUS: Record<string, string> = { pending: "À relire", approved: "Validé", rejected: "Refusé" };

/** Relecture des avis avant publication. Page invisible pour qui n'est pas dans ADMIN_EMAILS. */
export default async function AdminTestimonialsPage() {
  const user = await requireUser();
  if (!isAdminEmail(user.email, getServerEnv().ADMIN_EMAILS)) notFound();
  const items = await listTestimonialsForReview(getDb());
  const published = items.filter((item) => item.status === "approved" && item.publishConsent).length;
  const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">Validation des avis</h1>
        <p className="mt-1 text-sm text-muted">
          {published} avis publiable(s). La section du site apparaît à partir de {MIN_TESTIMONIALS_ON_SITE}.
        </p>
      </header>
      <Alert>
        Validez un avis tel qu&apos;il a été écrit : ne le réécrivez pas. Seuls les avis validés dont l&apos;auteur a
        accepté la publication apparaissent sur le site.
      </Alert>
      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Aucun avis pour le moment.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item._id.toHexString()}>
              <Card className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <p>
                    <span className="text-primary">{"★".repeat(item.rating)}</span>
                    <span className="text-white/15">{"★".repeat(5 - item.rating)}</span>{" "}
                    <span className="font-medium">{item.authorName}</span>
                    <span className="text-muted">
                      {" "}
                      · {item.authorRole}
                      {item.city ? ` · ${item.city}` : ""}
                    </span>
                  </p>
                  <p className="text-xs text-muted">
                    {STATUS[item.status]} · {item.publishConsent ? "publication autorisée" : "publication NON autorisée"} ·{" "}
                    {date.format(item.updatedAt)}
                  </p>
                </div>
                <p className="text-sm whitespace-pre-line">{item.text}</p>
                <ReviewButtons id={item._id.toHexString()} status={item.status} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

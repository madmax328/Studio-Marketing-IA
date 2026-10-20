import type { Metadata } from "next";
import { TestimonialForm } from "@/components/testimonials/testimonial-form";
import { Alert, Card } from "@/components/ui/card";
import { getDb } from "@/server/db/client";
import { getMyTestimonial } from "@/server/services/testimonials";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Votre avis" };

const STATUS: Record<string, string> = {
  pending: "En attente de relecture.",
  approved: "Validé.",
  rejected: "Non retenu pour le site (il reste enregistré, merci pour votre retour).",
};

export default async function TestimonialPage() {
  const user = await requireUser();
  const mine = await getMyTestimonial(getDb(), user.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">Votre avis</h1>
        <p className="mt-1 text-sm text-muted">
          Votre retour nous aide à améliorer le studio. Avec votre accord, il peut aussi aider d&apos;autres personnes à
          se décider.
        </p>
      </header>
      {mine ? (
        <Alert tone={mine.status === "rejected" ? "info" : "success"}>
          Statut : {STATUS[mine.status]}
          {mine.publishConsent ? "" : " Vous n'avez pas autorisé sa publication : il ne sera pas affiché sur le site."}
        </Alert>
      ) : null}
      <Card>
        <TestimonialForm
          defaultName={user.name}
          initial={
            mine
              ? { rating: mine.rating, text: mine.text, authorName: mine.authorName, authorRole: mine.authorRole, city: mine.city, publishConsent: mine.publishConsent }
              : null
          }
        />
      </Card>
    </div>
  );
}

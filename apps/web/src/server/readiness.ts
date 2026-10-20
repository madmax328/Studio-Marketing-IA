import "server-only";
import { SOCIAL_NETWORK_IDS, SOCIAL_NETWORKS } from "@smia/shared";
import { getImageProvider, getTextProvider } from "@/server/ai";
import { isStripeConfigured, priceIdsByPlan } from "@/server/billing/stripe";
import { ensureDatabaseReady, getDb } from "@/server/db/client";
import { collections } from "@/server/db/collections";
import { getServerEnv } from "@/server/env";
import { getMediaStorage } from "@/server/media/storage";
import { getOAuthProvider } from "@/server/social";
import { NETWORK_OAUTH_PROVIDER } from "@/server/social/oauth";
import { LEGAL } from "@/lib/legal";

export interface ReadinessCheck {
  id: string;
  label: string;
  ok: boolean;
  /** Bloquant pour l'ouverture commerciale (sinon : recommandé). */
  blocking: boolean;
  detail: string;
}

/**
 * État de l'installation avant l'ouverture : uniquement des oui/non et des explications,
 * jamais la valeur d'une clé ou d'un secret.
 */
export async function readinessReport(): Promise<{ ready: boolean; checks: ReadinessCheck[] }> {
  const env = getServerEnv();
  const checks: ReadinessCheck[] = [];
  const add = (check: ReadinessCheck) => checks.push(check);

  let dbOk = false;
  let plansOk = false;
  try {
    await ensureDatabaseReady();
    dbOk = true;
    plansOk = (await collections(getDb()).plans.countDocuments({ active: true })) > 0;
  } catch {
    dbOk = false;
  }
  add({ id: "database", label: "Base de données", ok: dbOk, blocking: true, detail: dbOk ? "Connectée, migrations appliquées." : "Connexion impossible : vérifiez MONGODB_URI et l'accès réseau d'Atlas." });
  add({ id: "plans", label: "Offres", ok: plansOk, blocking: true, detail: plansOk ? "Offres présentes en base." : "Aucune offre active en base." });
  add({ id: "app-url", label: "Adresse du site", ok: env.APP_URL.startsWith("https://"), blocking: true, detail: `APP_URL = ${env.APP_URL}` });

  const emailOk = Boolean(env.RESEND_API_KEY || (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD));
  add({ id: "email", label: "E-mails", ok: emailOk, blocking: true, detail: emailOk ? "Envoi configuré." : "Configurez SMTP (ou Resend) : sans e-mail, personne ne peut valider son compte." });
  add({ id: "email-from", label: "Expéditeur des e-mails", ok: !env.EMAIL_FROM.includes("example.com"), blocking: true, detail: env.EMAIL_FROM.includes("example.com") ? "EMAIL_FROM utilise encore l'adresse d'exemple." : "Expéditeur personnalisé." });

  add({ id: "ai", label: "IA de rédaction", ok: getTextProvider().isConfigured(), blocking: true, detail: getTextProvider().isConfigured() ? "Fournisseur configuré." : "Ajoutez ANTHROPIC_API_KEY." });
  add({ id: "images-ai", label: "Images par IA", ok: getImageProvider().isConfigured(), blocking: false, detail: getImageProvider().isConfigured() ? "Fournisseur d'images configuré." : "Facultatif : ajoutez OPENAI_API_KEY pour proposer la création d'images." });
  add({ id: "storage", label: "Stockage des images", ok: getMediaStorage().isConfigured(), blocking: true, detail: getMediaStorage().isConfigured() ? "Vercel Blob connecté." : "Connectez un store Vercel Blob au projet." });
  add({ id: "cron", label: "Envoi automatique", ok: Boolean(env.CRON_SECRET), blocking: true, detail: env.CRON_SECRET ? "CRON_SECRET défini (vérifiez que la tâche cron-job.org tourne chaque minute)." : "Ajoutez CRON_SECRET et la tâche planifiée." });
  add({ id: "encryption", label: "Chiffrement des jetons", ok: Boolean(env.SOCIAL_TOKEN_ENCRYPTION_KEY), blocking: true, detail: env.SOCIAL_TOKEN_ENCRYPTION_KEY ? "Clé définie." : "Ajoutez SOCIAL_TOKEN_ENCRYPTION_KEY (sans elle, aucun réseau réel ne peut être connecté)." });

  const available = SOCIAL_NETWORK_IDS.filter((id) => SOCIAL_NETWORKS[id].integrationStatus === "available");
  add({
    id: "networks",
    label: "Réseaux disponibles",
    ok: available.length > 0,
    blocking: true,
    detail: available.length > 0 ? available.map((id) => SOCIAL_NETWORKS[id].label).join(", ") : "Aucun réseau testé sur un vrai compte pour l'instant.",
  });
  const configured = [...new Set(Object.values(NETWORK_OAUTH_PROVIDER).filter((provider) => provider !== null))].filter((provider) => getOAuthProvider(provider) !== null);
  add({ id: "connectors", label: "Applications des réseaux", ok: configured.length > 0, blocking: false, detail: configured.length > 0 ? `Configurées : ${configured.join(", ")}.` : "Aucune application réseau configurée (voir docs/GUIDE_RESEAUX.md)." });
  add({
    id: "simulation",
    label: "Comptes de test désactivés",
    ok: env.SOCIAL_SIMULATION_ENABLED === "false",
    blocking: true,
    detail: env.SOCIAL_SIMULATION_ENABLED === "false" ? "Mode simulation coupé." : "Mettez SOCIAL_SIMULATION_ENABLED=false avant d'ouvrir.",
  });

  const stripe = isStripeConfigured() && Boolean(env.STRIPE_WEBHOOK_SECRET);
  const prices = Object.keys(priceIdsByPlan()).length;
  add({ id: "stripe", label: "Paiement", ok: stripe && prices === 3, blocking: false, detail: stripe ? `Stripe configuré, ${prices} prix sur 3.` : "Stripe non configuré : seule l'offre gratuite est proposée." });
  add({ id: "stripe-live", label: "Paiement en mode réel", ok: Boolean(env.STRIPE_SECRET_KEY?.startsWith("sk_live_")), blocking: false, detail: env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "Clé de production." : "Clé de test ou absente." });

  const legalMissing = (["companyName", "siret", "address", "publicationDirector", "contactEmail"] as const).filter((key) => !LEGAL[key].trim());
  add({ id: "legal", label: "Informations légales", ok: legalMissing.length === 0 && Boolean(LEGAL.mediator.name), blocking: true, detail: legalMissing.length === 0 ? (LEGAL.mediator.name ? "Complètes." : "Médiateur de la consommation à désigner.") : `À compléter dans src/lib/legal.ts : ${legalMissing.join(", ")}.` });

  return { ready: checks.every((check) => !check.blocking || check.ok), checks };
}

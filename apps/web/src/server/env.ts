import "server-only";
import { z } from "zod";

/**
 * Variables d'environnement côté serveur, validées à la première utilisation.
 * La validation est paresseuse pour que `next build` fonctionne sans base de données.
 */
/** Vercel peut transmettre des variables vides : on les traite comme absentes. */
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI est obligatoire"),
  MONGODB_DB_NAME: z.string().min(1).default("studio_marketing_ia"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET doit contenir au moins 32 caractères"),
  APP_URL: z.url("APP_URL doit être une URL complète (ex. http://localhost:3000)"),
  EMAIL_FROM: z.preprocess(emptyToUndefined, z.string().default("Studio Marketing IA <no-reply@example.com>")),
  RESEND_API_KEY: z.string().optional(),
  // SMTP (ex. boîte mail Hostinger : smtp.hostinger.com, port 465)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(465)),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  // Génération de texte par IA
  AI_TEXT_PROVIDER: z.preprocess(emptyToUndefined, z.enum(["anthropic"]).default("anthropic")),
  ANTHROPIC_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  AI_TEXT_MODEL: z.preprocess(emptyToUndefined, z.string().default("claude-opus-5-5")),
  AI_TEXT_EFFORT: z.preprocess(emptyToUndefined, z.enum(["low", "medium", "high"]).default("medium")),
  // Stockage des médias (Vercel Blob). Le jeton est ajouté automatiquement par Vercel à la connexion d'un store.
  BLOB_READ_WRITE_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  MEDIA_BLOB_ACCESS: z.preprocess(emptyToUndefined, z.enum(["private", "public"]).default("private")),
  // Publication automatique
  CRON_SECRET: z.preprocess(emptyToUndefined, z.string().min(16, "CRON_SECRET doit contenir au moins 16 caractères").optional()),
  SOCIAL_TOKEN_ENCRYPTION_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  /** Comptes de test qui simulent l'envoi sans rien publier. À désactiver avant l'ouverture commerciale. */
  SOCIAL_SIMULATION_ENABLED: z.preprocess(emptyToUndefined, z.enum(["true", "false"]).default("true")),
  // Connecteurs réels. Chaque réseau s'active dès que ses identifiants d'application sont renseignés.
  /** Application Meta (Facebook Login) : Pages Facebook et comptes Instagram professionnels. */
  META_APP_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  META_APP_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  META_GRAPH_VERSION: z.preprocess(emptyToUndefined, z.string().regex(/^v\d+\.\d+$/).default("v24.0")),
  /** Identifiants Threads (cas d'usage « Threads API » de l'application Meta, identifiants distincts). */
  THREADS_APP_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  THREADS_APP_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  /** Application LinkedIn (produits « Sign In with LinkedIn using OpenID Connect » et « Share on LinkedIn »). */
  LINKEDIN_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  LINKEDIN_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  LINKEDIN_API_VERSION: z.preprocess(emptyToUndefined, z.string().regex(/^\d{6}$/).default("202609")),
  // Abonnements (Stripe). Les identifiants de prix (price_…) se créent dans le tableau de bord Stripe.
  STRIPE_SECRET_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  STRIPE_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  STRIPE_PRICE_SOLO: z.preprocess(emptyToUndefined, z.string().optional()),
  STRIPE_PRICE_BUSINESS: z.preprocess(emptyToUndefined, z.string().optional()),
  STRIPE_PRICE_AGENCY: z.preprocess(emptyToUndefined, z.string().optional()),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Configuration serveur invalide :\n${details}`);
  }
  cached = parsed.data;
  return cached;
}

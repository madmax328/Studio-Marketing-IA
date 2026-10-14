import "server-only";
import { z } from "zod";

/**
 * Variables d'environnement côté serveur, validées à la première utilisation.
 * La validation est paresseuse pour que `next build` fonctionne sans base de données.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI est obligatoire"),
  MONGODB_DB_NAME: z.string().min(1).default("studio_marketing_ia"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET doit contenir au moins 32 caractères"),
  APP_URL: z.url("APP_URL doit être une URL complète (ex. http://localhost:3000)"),
  EMAIL_FROM: z.string().default("Studio Marketing IA <no-reply@example.com>"),
  RESEND_API_KEY: z.string().optional(),
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

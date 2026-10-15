import "server-only";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { getDb, getMongoClient } from "@/server/db/client";
import { sendEmail } from "@/server/email";
import { getServerEnv } from "@/server/env";
import { getStripe, isStripeConfigured } from "@/server/billing/stripe";
import { deleteUserData } from "@/server/services/account";
import { cancelSubscriptionsOfOwner } from "@/server/services/subscriptions";

function createAuth() {
  const env = getServerEnv();

  return betterAuth({
    appName: "Studio Marketing IA",
    baseURL: env.APP_URL,
    secret: env.AUTH_SECRET,
    database: mongodbAdapter(getDb(), { client: getMongoClient() }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      async sendResetPassword({ user, url }) {
        await sendEmail({
          to: user.email,
          subject: "Réinitialisation de votre mot de passe",
          text: `Bonjour,\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${url}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      async sendVerificationEmail({ user, url }) {
        await sendEmail({
          to: user.email,
          subject: "Confirmez votre adresse e-mail",
          text: `Bienvenue sur Studio Marketing IA !\n\nConfirmez votre adresse en ouvrant ce lien :\n${url}\n\nSi vous n'avez pas créé de compte, ignorez cet e-mail.`,
        });
      },
    },
    user: {
      deleteUser: {
        enabled: true,
        async beforeDelete(user) {
          // Résilier d'abord : un compte supprimé ne doit plus jamais être prélevé.
          await cancelSubscriptionsOfOwner(getDb(), user.id, isStripeConfigured() ? getStripe() : null);
          await deleteUserData(user.id);
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: env.NODE_ENV === "production",
      // Stockage en base : la mémoire n'est pas partagée entre instances serverless.
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
        "/request-password-reset": { window: 300, max: 3 },
        "/send-verification-email": { window: 300, max: 3 },
      },
    },
    advanced: {
      useSecureCookies: env.NODE_ENV === "production",
    },
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as typeof globalThis & { __smiaAuth?: Auth };

/** Instance Better Auth, créée à la première utilisation (pas au build). */
export function getAuth(): Auth {
  globalForAuth.__smiaAuth ??= createAuth();
  return globalForAuth.__smiaAuth;
}

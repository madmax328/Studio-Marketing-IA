import "server-only";
import nodemailer from "nodemailer";
import { getServerEnv, type ServerEnv } from "@/server/env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Envoie un e-mail transactionnel avec le premier moyen configuré :
 * 1. Resend (RESEND_API_KEY) ;
 * 2. SMTP (SMTP_HOST, SMTP_USER, SMTP_PASSWORD), par exemple une boîte Hostinger ;
 * 3. aucun : en développement, le message est affiché dans la console (signalé comme
 *    non envoyé) ; en production, l'envoi échoue. On ne prétend jamais avoir envoyé un e-mail.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const env = getServerEnv();

  if (env.RESEND_API_KEY) return sendWithResend(env, env.RESEND_API_KEY, message);
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD) return sendWithSmtp(env, message);

  if (env.NODE_ENV === "production") {
    throw new Error("Envoi d'e-mail impossible : configurez RESEND_API_KEY ou SMTP_HOST, SMTP_USER et SMTP_PASSWORD.");
  }
  console.info(
    `\n[E-MAIL NON ENVOYÉ — mode développement]\nÀ : ${message.to}\nObjet : ${message.subject}\n\n${message.text}\n`,
  );
}

async function sendWithResend(env: ServerEnv, apiKey: string, message: EmailMessage): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [message.to], subject: message.subject, text: message.text }),
  });
  if (!response.ok) {
    // Le corps de la réponse peut contenir des détails utiles, jamais la clé.
    const detail = await response.text().catch(() => "");
    throw new Error(`Échec de l'envoi de l'e-mail (${response.status}) ${detail.slice(0, 200)}`);
  }
}

async function sendWithSmtp(env: ServerEnv, message: EmailMessage): Promise<void> {
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // Port 465 : connexion chiffrée dès le départ ; autres ports : STARTTLS.
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
  try {
    await transport.sendMail({ from: env.EMAIL_FROM, to: message.to, subject: message.subject, text: message.text });
  } catch (error) {
    // Message d'erreur sans identifiants.
    throw new Error(`Échec de l'envoi de l'e-mail par SMTP : ${error instanceof Error ? error.message : "erreur inconnue"}`);
  }
}

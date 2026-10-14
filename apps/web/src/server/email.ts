import "server-only";
import { getServerEnv } from "@/server/env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Envoie un e-mail transactionnel via l'API Resend.
 *
 * Sans RESEND_API_KEY :
 * - en développement, le message est affiché dans la console du serveur
 *   (clairement signalé comme non envoyé) pour pouvoir tester les parcours ;
 * - en production, l'envoi échoue : on ne prétend jamais avoir envoyé un e-mail.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const env = getServerEnv();

  if (!env.RESEND_API_KEY) {
    if (env.NODE_ENV === "production") {
      throw new Error("Envoi d'e-mail impossible : RESEND_API_KEY n'est pas configurée.");
    }
    console.info(
      `\n[E-MAIL NON ENVOYÉ — mode développement]\nÀ : ${message.to}\nObjet : ${message.subject}\n\n${message.text}\n`,
    );
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [message.to], subject: message.subject, text: message.text }),
  });

  if (!response.ok) {
    // Le corps de la réponse peut contenir des détails utiles, jamais la clé.
    const detail = await response.text().catch(() => "");
    throw new Error(`Échec de l'envoi de l'e-mail (${response.status}) ${detail.slice(0, 200)}`);
  }
}

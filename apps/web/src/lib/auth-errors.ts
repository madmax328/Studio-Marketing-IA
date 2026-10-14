const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou mot de passe incorrect.",
  INVALID_EMAIL: "Adresse e-mail invalide.",
  INVALID_PASSWORD: "Mot de passe incorrect.",
  EMAIL_NOT_VERIFIED: "Votre adresse e-mail n'est pas encore confirmée. Un nouveau lien vient de vous être envoyé.",
  PASSWORD_TOO_SHORT: "Le mot de passe doit contenir au moins 10 caractères.",
  PASSWORD_TOO_LONG: "Le mot de passe est trop long.",
  USER_ALREADY_EXISTS: "Un compte existe déjà avec cette adresse e-mail.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Un compte existe déjà avec cette adresse e-mail.",
  INVALID_TOKEN: "Ce lien n'est plus valide. Faites une nouvelle demande.",
  TOKEN_EXPIRED: "Ce lien a expiré. Faites une nouvelle demande.",
  SESSION_NOT_FRESH: "Pour des raisons de sécurité, reconnectez-vous puis réessayez.",
};

/** Traduit une erreur Better Auth en message compréhensible. */
export function authErrorMessage(error: { code?: string | undefined; status?: number } | null | undefined): string {
  if (!error) return "Une erreur inattendue est survenue.";
  if (error.status === 429) return "Trop de tentatives. Patientez quelques minutes avant de réessayer.";
  return (error.code && MESSAGES[error.code]) || "Une erreur est survenue. Réessayez dans un instant.";
}

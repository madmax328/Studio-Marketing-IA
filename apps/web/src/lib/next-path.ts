/**
 * Adresse de retour après connexion ou inscription. Seuls les liens d'invitation sont acceptés :
 * jamais une adresse extérieure (redirection ouverte).
 */
export function safeNextPath(value: unknown): string | null {
  return typeof value === "string" && /^\/invitation\/[A-Za-z0-9_-]{20,100}$/.test(value) ? value : null;
}

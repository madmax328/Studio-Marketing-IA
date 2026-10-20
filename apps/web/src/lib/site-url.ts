/**
 * Adresse publique du site (référencement, aperçus de partage). Lue sans valider toute la configuration
 * serveur, pour que la compilation fonctionne aussi sans variables d'environnement.
 */
export function publicSiteUrl(): string {
  const raw = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:3000";
  }
}

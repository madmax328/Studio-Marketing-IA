/**
 * Fonctions optionnelles activées par la configuration, lisibles pendant la compilation des pages publiques
 * (sans valider toute la configuration serveur). Le site n'annonce une fonction que si elle est réellement active.
 */
export function imageAiAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/** Lien de téléchargement de l'application de bureau (Windows), une fois publiée. */
export function desktopDownloadUrl(): string | null {
  const url = process.env.DESKTOP_DOWNLOAD_URL?.trim();
  return url && url.startsWith("https://") ? url : null;
}

/** La voix off utilise le même fournisseur (OpenAI) que les images. */
export function voiceAiAvailable(): boolean {
  return imageAiAvailable();
}

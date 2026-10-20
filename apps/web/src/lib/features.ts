/**
 * Fonctions optionnelles activées par la configuration, lisibles pendant la compilation des pages publiques
 * (sans valider toute la configuration serveur). Le site n'annonce une fonction que si elle est réellement active.
 */
export function imageAiAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

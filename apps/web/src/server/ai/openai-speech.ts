import "server-only";
import { getServerEnv } from "@/server/env";
import { TextGenerationError, type ProviderResult, type SpeechGenerationProvider } from "./types";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Voix de synthèse OpenAI (API Audio). La clé ne quitte jamais le serveur. */
export function createOpenAiSpeechProvider(options: { fetch?: FetchLike; config?: () => { apiKey?: string; model: string } } = {}): SpeechGenerationProvider {
  const fetchImpl = options.fetch ?? fetch;
  const config =
    options.config ??
    (() => {
      const env = getServerEnv();
      return { apiKey: env.OPENAI_API_KEY, model: env.AI_SPEECH_MODEL };
    });

  return {
    id: "openai-speech",
    label: "OpenAI (voix off)",
    dataProcessor: "OpenAI",
    isConfigured: () => Boolean(config().apiKey),
    async generateSpeech(input): Promise<ProviderResult<Buffer>> {
      const { apiKey, model } = config();
      if (!apiKey) throw new TextGenerationError("La voix off n'est pas configurée.", false);

      let response: Response;
      try {
        response = await fetchImpl("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, input: input.text, voice: input.voice, instructions: input.instructions, response_format: "mp3" }),
          signal: AbortSignal.timeout(60_000),
        });
      } catch {
        throw new TextGenerationError("Le service de voix n'a pas répondu. Réessayez dans un instant.", true);
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new TextGenerationError("La clé du service de voix est refusée.", false);
        if (response.status === 429) throw new TextGenerationError("Le service de voix est très sollicité. Réessayez dans une minute.", true);
        if (response.status === 400) throw new TextGenerationError("Ce texte a été refusé par le service de voix. Reformulez-le.", false);
        throw new TextGenerationError("Le service de voix a rencontré une erreur. Réessayez dans un instant.", true);
      }
      const audio = Buffer.from(await response.arrayBuffer());
      if (audio.length < 100) throw new TextGenerationError("Le service de voix n'a renvoyé aucun son.", true);
      // Facturation au caractère : l'API ne renvoie pas de jetons.
      return { output: audio, model, usage: { inputTokens: input.text.length, outputTokens: 0 } };
    },
  };
}

import "server-only";
import { getServerEnv } from "@/server/env";
import { TextGenerationError, type ImageGenerationInput, type ImageGenerationProvider, type ProviderResult } from "./types";

const SIZES: Record<ImageGenerationInput["orientation"], string> = {
  square: "1024x1024",
  portrait: "1024x1536",
  landscape: "1536x1024",
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Fournisseur d'images OpenAI (API Images). La clé ne quitte jamais le serveur. */
export function createOpenAiImageProvider(options: { fetch?: FetchLike; config?: () => { apiKey?: string; model: string; quality: string } } = {}): ImageGenerationProvider {
  const fetchImpl = options.fetch ?? fetch;
  const config =
    options.config ??
    (() => {
      const env = getServerEnv();
      return { apiKey: env.OPENAI_API_KEY, model: env.AI_IMAGE_MODEL, quality: env.AI_IMAGE_QUALITY };
    });

  return {
    id: "openai-images",
    label: "OpenAI (création d'images)",
    dataProcessor: "OpenAI",
    isConfigured: () => Boolean(config().apiKey),
    async generateImage(input): Promise<ProviderResult<Buffer>> {
      const { apiKey, model, quality } = config();
      if (!apiKey) throw new TextGenerationError("La création d'images n'est pas configurée.", false);

      let response: Response;
      try {
        response = await fetchImpl("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, prompt: input.prompt, size: SIZES[input.orientation], quality, n: 1 }),
          signal: AbortSignal.timeout(110_000),
        });
      } catch {
        throw new TextGenerationError("Le service d'images n'a pas répondu. Réessayez dans un instant.", true);
      }

      const body = (await response.json().catch(() => null)) as {
        data?: { b64_json?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
        error?: { code?: string; message?: string };
      } | null;

      if (!response.ok) {
        const code = body?.error?.code ?? "";
        if (code === "moderation_blocked" || code === "content_policy_violation") {
          throw new TextGenerationError("Cette description a été refusée par le filtre de sécurité du service d'images. Reformulez-la.", false);
        }
        if (response.status === 401 || response.status === 403) throw new TextGenerationError("La clé du service d'images est refusée.", false);
        if (response.status === 429) throw new TextGenerationError("Le service d'images est très sollicité. Réessayez dans une minute.", true);
        throw new TextGenerationError("Le service d'images a rencontré une erreur. Réessayez dans un instant.", true);
      }

      const b64 = body?.data?.[0]?.b64_json;
      if (!b64) throw new TextGenerationError("Le service d'images n'a renvoyé aucune image.", true);
      return {
        output: Buffer.from(b64, "base64"),
        model,
        usage: { inputTokens: body?.usage?.input_tokens ?? 0, outputTokens: body?.usage?.output_tokens ?? 0 },
      };
    },
  };
}

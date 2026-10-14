import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { generationOutputSchema } from "@smia/shared";
import { getServerEnv } from "@/server/env";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import { TextGenerationError, type TextGenerationProvider } from "./types";

let client: Anthropic | undefined;

function getClient(apiKey: string): Anthropic {
  client ??= new Anthropic({ apiKey, timeout: 90_000, maxRetries: 1 });
  return client;
}

/** Fournisseur cloud : Claude (Anthropic). */
export const anthropicTextProvider: TextGenerationProvider = {
  id: "anthropic",
  label: "Claude (Anthropic)",
  dataProcessor: "Anthropic PBC",

  isConfigured() {
    return Boolean(getServerEnv().ANTHROPIC_API_KEY);
  },

  async generatePosts(input) {
    const env = getServerEnv();
    if (!env.ANTHROPIC_API_KEY) {
      throw new TextGenerationError("La génération de texte n'est pas encore configurée (clé API manquante).", false);
    }

    let response;
    try {
      response = await getClient(env.ANTHROPIC_API_KEY).beta.messages.parse({
        model: env.AI_TEXT_MODEL,
        max_tokens: 16000,
        // En cas de refus par un filtre de sécurité, la requête est relancée sur le modèle de repli recommandé.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: env.AI_TEXT_EFFORT, format: betaZodOutputFormat(generationOutputSchema) },
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: buildUserPrompt(input) }],
      });
    } catch (error) {
      throw toGenerationError(error);
    }

    if (response.stop_reason === "refusal") {
      throw new TextGenerationError("L'IA a refusé cette demande. Reformulez votre sujet puis réessayez.", false);
    }
    if (response.stop_reason === "max_tokens") {
      throw new TextGenerationError("La réponse de l'IA était trop longue. Demandez moins de versions.", false);
    }
    if (!response.parsed_output) {
      throw new TextGenerationError("La réponse de l'IA était incomplète. Réessayez.", true);
    }

    return {
      output: response.parsed_output,
      model: response.model,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  },
};

function toGenerationError(error: unknown): TextGenerationError {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    console.error("Clé Anthropic refusée", error.status);
    return new TextGenerationError("Le service d'IA est mal configuré. Contactez le support.", false);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new TextGenerationError("Le service d'IA est très sollicité. Réessayez dans une minute.", true);
  }
  if (error instanceof Anthropic.BadRequestError) {
    console.error("Requête refusée par Anthropic", error.message);
    return new TextGenerationError("La demande n'a pas pu être traitée. Réessayez.", false);
  }
  if (error instanceof Anthropic.APIConnectionError || error instanceof Anthropic.InternalServerError) {
    return new TextGenerationError("Le service d'IA ne répond pas. Réessayez dans un instant.", true);
  }
  if (error instanceof Anthropic.APIError) {
    console.error("Erreur Anthropic", error.status, error.message);
    return new TextGenerationError("Le service d'IA a rencontré une erreur. Réessayez.", true);
  }
  console.error("Erreur inattendue pendant la génération", error);
  return new TextGenerationError("Une erreur inattendue est survenue. Réessayez.", true);
}

import { describe, expect, it, vi } from "vitest";
import { createOpenAiSpeechProvider } from "../openai-speech";

const config = () => ({ apiKey: "sk-test", model: "gpt-4o-mini-tts" });
const input = { text: "Bonjour et bienvenue.", voice: "coral", instructions: "Voix off française." };

describe("voix off OpenAI", () => {
  it("envoie le texte, la voix et les consignes, la clé dans l'en-tête, et renvoie le MP3", async () => {
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://api.openai.com/v1/audio/speech");
      expect(JSON.parse(String(init?.body))).toEqual({ model: "gpt-4o-mini-tts", input: input.text, voice: "coral", instructions: input.instructions, response_format: "mp3" });
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer sk-test");
      return new Response(new Uint8Array(500).fill(7));
    });
    const result = await createOpenAiSpeechProvider({ fetch, config }).generateSpeech(input);
    expect(result.output).toHaveLength(500);
    expect(result.usage.inputTokens).toBe(input.text.length);
  });

  it("classe les erreurs : clé refusée définitive, surcharge temporaire", async () => {
    const refused = createOpenAiSpeechProvider({ fetch: async () => new Response("{}", { status: 401 }), config });
    await expect(refused.generateSpeech(input)).rejects.toMatchObject({ retryable: false });
    const busy = createOpenAiSpeechProvider({ fetch: async () => new Response("{}", { status: 429 }), config });
    await expect(busy.generateSpeech(input)).rejects.toMatchObject({ retryable: true });
  });

  it("n'est pas disponible sans clé", () => {
    expect(createOpenAiSpeechProvider({ config: () => ({ model: "m" }) }).isConfigured()).toBe(false);
  });
});

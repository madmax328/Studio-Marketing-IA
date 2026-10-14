/**
 * Vérifie l'appel au SDK Anthropic sans réseau : la réponse de l'API est simulée.
 * Ce test ne prouve pas que la clé ou le modèle fonctionnent en réel ; il vérifie
 * la forme de la requête envoyée et le traitement des réponses.
 */
import { brandInputSchema } from "@smia/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const input = {
  brand: brandInputSchema.parse({ name: "Café du Port" }),
  networks: ["instagram" as const],
  kind: "libre" as const,
  brief: "Nouvelle terrasse ouverte",
  tone: "chaleureux" as const,
  variantsPerNetwork: 1,
};

function apiResponse(body: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "claude-opus-5-5",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 50 },
      ...body,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("fournisseur Anthropic", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    process.env.MONGODB_URI = "mongodb://localhost:27017";
    process.env.AUTH_SECRET = "x".repeat(32);
    process.env.APP_URL = "http://localhost:3000";
    process.env.ANTHROPIC_API_KEY = "sk-test";
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("envoie une requête structurée avec repli et renvoie la sortie validée", async () => {
    const output = {
      posts: [{ network: "instagram", text: "Notre terrasse est ouverte !", hashtags: ["terrasse"], rationale: "Annonce." }],
      missingInformation: ["Horaires d'ouverture de la terrasse"],
    };
    fetchMock.mockResolvedValue(apiResponse({ content: [{ type: "text", text: JSON.stringify(output) }] }));

    const { anthropicTextProvider } = await import("@/server/ai/anthropic");
    const result = await anthropicTextProvider.generatePosts(input);

    expect(result.output).toEqual(output);
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50 });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    const headers = new Headers(init.headers);
    expect(body.model).toBe("claude-opus-5-5");
    expect(body.fallbacks).toBe("default");
    expect(headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    expect(body.output_config).toMatchObject({ effort: "medium", format: { type: "json_schema" } });
    expect(JSON.stringify(body.system)).toContain("N'invente jamais de prix");
  });

  it("signale un refus sans renvoyer de contenu", async () => {
    fetchMock.mockResolvedValue(apiResponse({ content: [], stop_reason: "refusal" }));
    const { anthropicTextProvider } = await import("@/server/ai/anthropic");
    await expect(anthropicTextProvider.generatePosts(input)).rejects.toThrow("refusé");
  });

  it("traduit une clé invalide en message compréhensible", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );
    const { anthropicTextProvider } = await import("@/server/ai/anthropic");
    await expect(anthropicTextProvider.generatePosts(input)).rejects.toThrow("mal configuré");
  });
});

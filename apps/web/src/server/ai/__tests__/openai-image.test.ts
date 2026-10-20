import { describe, expect, it, vi } from "vitest";
import { buildImagePrompt, orientationFor } from "../image-prompt";
import { createOpenAiImageProvider } from "../openai-image";

const config = () => ({ apiKey: "sk-test", model: "gpt-image-1", quality: "medium" });

describe("fournisseur d'images OpenAI", () => {
  it("envoie la bonne taille, la clé dans l'en-tête, et renvoie l'image décodée", async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({ model: "gpt-image-1", size: "1024x1536", quality: "medium", n: 1 });
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer sk-test");
      return Response.json({ data: [{ b64_json: Buffer.from("image").toString("base64") }], usage: { input_tokens: 40, output_tokens: 1000 } });
    });
    const result = await createOpenAiImageProvider({ fetch, config }).generateImage({ prompt: "x", orientation: "portrait" });
    expect(result.output.toString()).toBe("image");
    expect(result.usage).toEqual({ inputTokens: 40, outputTokens: 1000 });
  });

  it("explique un refus du filtre de sécurité, sans nouvel essai", async () => {
    const fetch = vi.fn(async () => Response.json({ error: { code: "moderation_blocked", message: "blocked" } }, { status: 400 }));
    await expect(createOpenAiImageProvider({ fetch, config }).generateImage({ prompt: "x", orientation: "square" })).rejects.toMatchObject({
      retryable: false,
      message: expect.stringContaining("filtre de sécurité"),
    });
  });

  it("n'est pas disponible sans clé", () => {
    expect(createOpenAiImageProvider({ config: () => ({ model: "m", quality: "low" }) }).isConfigured()).toBe(false);
  });
});

describe("consigne d'image", () => {
  it("interdit tout texte et logo, transmet le secteur, les couleurs et le format", () => {
    const prompt = buildImagePrompt({ industry: "Studio de yoga", brandColors: ["#264653", "#e76f51"] }, { description: "un tapis près d'une fenêtre", format: "portrait", style: "photo" });
    expect(prompt).toContain("Studio de yoga");
    expect(prompt).toContain("#264653");
    expect(prompt).toContain("1080 × 1350");
    expect(prompt).toContain("aucun texte");
    expect(prompt).toContain("aucun logo");
  });

  it("choisit l'orientation la plus proche du format", () => {
    expect(orientationFor("square")).toBe("square");
    expect(orientationFor("story")).toBe("portrait");
    expect(orientationFor("landscape")).toBe("landscape");
  });
});

import { describe, expect, it, vi } from "vitest";
import { createOpenAiVideoProvider } from "../openai-video";

const config = () => ({ apiKey: "sk-test", model: "sora-2" });

describe("vidéos OpenAI", () => {
  it("lance la création (format, durée), suit l'avancement et récupère le fichier", async () => {
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer sk-test");
      if (init?.method === "POST") {
        expect(JSON.parse(String(init.body))).toEqual({ model: "sora-2", prompt: "scène", size: "720x1280", seconds: "8" });
        return Response.json({ id: "video_1", model: "sora-2", status: "queued" });
      }
      if (url.endsWith("/content")) return new Response(new Uint8Array([1, 2, 3]));
      if (url.endsWith("/content?variant=thumbnail")) return new Response(new Uint8Array([9]));
      return Response.json({ id: "video_1", status: "in_progress", progress: 42 });
    });
    const provider = createOpenAiVideoProvider({ fetch, config });
    expect(await provider.startVideo({ prompt: "scène", orientation: "vertical", seconds: 8 })).toEqual({ id: "video_1", model: "sora-2" });
    expect(await provider.getVideo("video_1")).toEqual({ status: "in_progress", progress: 42, error: null });
    expect([...(await provider.downloadVideo("video_1", "video"))]).toEqual([1, 2, 3]);
    expect([...(await provider.downloadVideo("video_1", "thumbnail"))]).toEqual([9]);
  });

  it("refus du filtre de sécurité : définitif, avec une explication", async () => {
    const fetch = vi.fn(async () => Response.json({ error: { code: "moderation_blocked", message: "x" } }, { status: 400 }));
    await expect(createOpenAiVideoProvider({ fetch, config }).startVideo({ prompt: "x", orientation: "horizontal", seconds: 4 })).rejects.toMatchObject({
      retryable: false,
      message: expect.stringContaining("filtre de sécurité"),
    });
  });

  it("n'est pas disponible sans clé", () => {
    expect(createOpenAiVideoProvider({ config: () => ({ model: "sora-2" }) }).isConfigured()).toBe(false);
  });
});

import "server-only";
import { getServerEnv } from "@/server/env";
import { TextGenerationError, type VideoGenerationProvider, type VideoJobState } from "./types";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const API_URL = "https://api.openai.com/v1/videos";
const SIZES = { vertical: "720x1280", horizontal: "1280x720" } as const;
const STATUSES: readonly VideoJobState["status"][] = ["queued", "in_progress", "completed", "failed"];

/** Vidéos OpenAI (API Videos, modèles Sora). La clé ne quitte jamais le serveur. */
export function createOpenAiVideoProvider(options: { fetch?: FetchLike; config?: () => { apiKey?: string; model: string } } = {}): VideoGenerationProvider {
  const fetchImpl = options.fetch ?? fetch;
  const config =
    options.config ??
    (() => {
      const env = getServerEnv();
      return { apiKey: env.OPENAI_API_KEY, model: env.AI_VIDEO_MODEL };
    });

  async function call(path: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<Response> {
    const { apiKey } = config();
    if (!apiKey) throw new TextGenerationError("La création de vidéos n'est pas configurée.", false);
    let response: Response;
    try {
      response = await fetchImpl(`${API_URL}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${apiKey}`, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new TextGenerationError("Le service de vidéos n'a pas répondu. Réessayez dans un instant.", true);
    }
    if (response.ok) return response;
    const body = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    const code = body?.error?.code ?? "";
    if (code === "moderation_blocked" || code === "content_policy_violation" || code.includes("moderation")) {
      throw new TextGenerationError("Cette description a été refusée par le filtre de sécurité du service de vidéos. Reformulez-la.", false);
    }
    if (response.status === 401 || response.status === 403) throw new TextGenerationError("La clé du service de vidéos est refusée.", false);
    if (response.status === 429) throw new TextGenerationError("Le service de vidéos est très sollicité. Réessayez dans quelques minutes.", true);
    throw new TextGenerationError("Le service de vidéos a rencontré une erreur. Réessayez plus tard.", true);
  }

  return {
    id: "openai-video",
    label: "OpenAI (création de vidéos)",
    dataProcessor: "OpenAI",
    isConfigured: () => Boolean(config().apiKey),

    async startVideo({ prompt, orientation, seconds }) {
      const { model } = config();
      const response = await call("", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, size: SIZES[orientation], seconds: String(seconds) }),
      });
      const body = (await response.json().catch(() => null)) as { id?: string; model?: string } | null;
      if (!body?.id) throw new TextGenerationError("Le service de vidéos n'a pas accepté la demande. Réessayez.", true);
      return { id: body.id, model: body.model ?? model };
    },

    async getVideo(id) {
      const response = await call(`/${encodeURIComponent(id)}`);
      const body = (await response.json().catch(() => null)) as { status?: string; progress?: number; error?: { message?: string } | null } | null;
      const status = STATUSES.find((item) => item === body?.status);
      if (!status) throw new TextGenerationError("Réponse inattendue du service de vidéos.", true);
      return {
        status,
        progress: typeof body?.progress === "number" ? Math.max(0, Math.min(100, body.progress)) : null,
        error: body?.error?.message ?? null,
      };
    },

    async downloadVideo(id, variant) {
      const response = await call(`/${encodeURIComponent(id)}/content${variant === "thumbnail" ? "?variant=thumbnail" : ""}`, {}, 120_000);
      return Buffer.from(await response.arrayBuffer());
    },
  };
}

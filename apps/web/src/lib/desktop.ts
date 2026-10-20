/**
 * Passerelle vers l'application de bureau (Tauri) : le site, ouvert dans l'application, peut faire écrire le modèle
 * d'IA installé sur l'ordinateur (Ollama). Dans un navigateur ordinaire, rien de tout cela n'est disponible.
 */

/** Modèle conseillé : bon en français, sorties structurées fiables, ≈ 4,7 Go, tourne sur un ordinateur récent. */
export const RECOMMENDED_LOCAL_MODEL = "qwen2.5:7b";

export interface LocalAiStatus {
  /** Ollama répond sur cet ordinateur. */
  running: boolean;
  models: string[];
}

export interface PullProgress {
  status: string;
  completed: number | null;
  total: number | null;
}

/** Sommes-nous dans l'application de bureau ? */
export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export function localAiStatus(): Promise<LocalAiStatus> {
  return invoke<LocalAiStatus>("local_ai_status");
}

/** Télécharge un modèle sur l'ordinateur, en suivant la progression. */
export async function pullLocalModel(model: string, onProgress: (progress: PullProgress) => void): Promise<void> {
  const { listen } = await import("@tauri-apps/api/event");
  const stop = await listen<PullProgress>("local-ai-pull", (event) => onProgress(event.payload));
  try {
    await invoke("local_ai_pull", { model });
  } finally {
    stop();
  }
}

/** Fait écrire le modèle local ; renvoie le texte JSON produit (validé ensuite par le serveur). */
export function localGenerate(request: { model: string; system: string; user: string; schema: unknown }): Promise<string> {
  return invoke<string>("local_ai_generate", { request });
}

import "server-only";
import { del, get, head, put } from "@vercel/blob";
import { getServerEnv } from "@/server/env";

/**
 * Stockage objet des médias. Interface indépendante du service pour pouvoir passer
 * à un stockage compatible S3 (Cloudflare R2…) sans toucher au reste de l'application.
 */
export interface MediaStorage {
  isConfigured(): boolean;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Lit un fichier ; null s'il n'existe pas. */
  read(key: string): Promise<{ stream: ReadableStream<Uint8Array>; contentType: string; size: number } | null>;
  readBuffer(key: string): Promise<Buffer | null>;
  stat(key: string): Promise<{ size: number; contentType: string } | null>;
  remove(keys: string[]): Promise<void>;
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && error.name === "BlobNotFoundError";
}

export const vercelBlobStorage: MediaStorage = {
  isConfigured() {
    return Boolean(getServerEnv().BLOB_READ_WRITE_TOKEN);
  },

  async put(key, body, contentType) {
    const env = getServerEnv();
    await put(key, body, {
      access: env.MEDIA_BLOB_ACCESS,
      contentType,
      addRandomSuffix: false,
      allowOverwrite: false,
      token: env.BLOB_READ_WRITE_TOKEN,
    });
  },

  async read(key) {
    const env = getServerEnv();
    const result = await get(key, { access: env.MEDIA_BLOB_ACCESS, token: env.BLOB_READ_WRITE_TOKEN });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const info = await this.stat(key);
    return { stream: result.stream, contentType: info?.contentType ?? "application/octet-stream", size: info?.size ?? 0 };
  },

  async readBuffer(key) {
    const file = await this.read(key);
    if (!file) return null;
    return Buffer.from(await new Response(file.stream).arrayBuffer());
  },

  async stat(key) {
    try {
      const info = await head(key, { token: getServerEnv().BLOB_READ_WRITE_TOKEN });
      return { size: info.size, contentType: info.contentType };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  },

  async remove(keys) {
    if (keys.length === 0) return;
    await del(keys, { token: getServerEnv().BLOB_READ_WRITE_TOKEN });
  },
};

export function getMediaStorage(): MediaStorage {
  return vercelBlobStorage;
}

/** Préfixe obligatoire de tous les fichiers d'un espace : garantit l'isolation dans le stockage. */
export function workspaceStoragePrefix(workspaceId: string): string {
  return `ws/${workspaceId}/`;
}

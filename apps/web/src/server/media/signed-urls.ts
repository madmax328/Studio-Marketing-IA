import "server-only";
import { sign, verifySignature } from "@/server/security/crypto";

/** Durée de validité des liens temporaires vers un média (le réseau doit le télécharger dans ce délai). */
export const SIGNED_URL_TTL_SECONDS = 2 * 60 * 60;

function payload(mediaId: string, expires: number): string {
  return `media:${mediaId}:${expires}`;
}

export function signedMediaUrl(appUrl: string, secret: string, mediaId: string, now = Date.now()): string {
  const expires = Math.floor(now / 1000) + SIGNED_URL_TTL_SECONDS;
  const signature = sign(payload(mediaId, expires), secret);
  return `${appUrl.replace(/\/$/, "")}/api/medias/public/${mediaId}?exp=${expires}&sig=${signature}`;
}

export function verifySignedMedia(secret: string, mediaId: string, expires: string | null, signature: string | null, now = Date.now()): boolean {
  if (!expires || !signature || !/^\d+$/.test(expires)) return false;
  if (Number(expires) * 1000 < now) return false;
  return verifySignature(payload(mediaId, Number(expires)), signature, secret);
}

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Vérifie un « signed_request » Meta (Facebook, Threads) : `signature.payload` en base64url,
 * signature = HMAC-SHA256(payload, secret de l'application). Retourne le contenu, ou null si invalide.
 */
export function parseSignedRequest(signedRequest: string, appSecret: string): { userId: string; issuedAt: number | null } | null {
  const [signature, payload] = signedRequest.split(".");
  if (!signature || !payload) return null;
  const expected = createHmac("sha256", appSecret).update(payload).digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof data.algorithm === "string" && data.algorithm.toUpperCase() !== "HMAC-SHA256") return null;
    const userId = typeof data.user_id === "string" || typeof data.user_id === "number" ? String(data.user_id) : null;
    if (!userId) return null;
    return { userId, issuedAt: typeof data.issued_at === "number" ? data.issued_at : null };
  } catch {
    return null;
  }
}

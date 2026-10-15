import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Valeur chiffrée stockée en base (AES-256-GCM). */
export interface EncryptedValue {
  v: 1;
  iv: string;
  tag: string;
  data: string;
}

function key(rawKey: string): Buffer {
  const buffer = Buffer.from(rawKey, "base64");
  if (buffer.length !== 32) {
    throw new Error("La clé de chiffrement doit faire 32 octets encodés en base64.");
  }
  return buffer;
}

/** Chiffre un secret (jeton d'accès…) avant de l'enregistrer. */
export function encryptSecret(plain: string, rawKey: string): EncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(rawKey), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return { v: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

export function decryptSecret(value: EncryptedValue, rawKey: string): string {
  const decipher = createDecipheriv("aes-256-gcm", key(rawKey), Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(value.data, "base64")), decipher.final()]).toString("utf8");
}

/** Signature HMAC (liens temporaires, état OAuth). */
export function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

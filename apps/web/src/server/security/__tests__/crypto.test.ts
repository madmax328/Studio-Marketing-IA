import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, sign, verifySignature } from "@/server/security/crypto";

const rawKey = randomBytes(32).toString("base64");

describe("chiffrement des jetons", () => {
  it("chiffre et déchiffre sans laisser le secret en clair", () => {
    const encrypted = encryptSecret("jeton-secret-123", rawKey);
    expect(JSON.stringify(encrypted)).not.toContain("jeton-secret-123");
    expect(decryptSecret(encrypted, rawKey)).toBe("jeton-secret-123");
  });

  it("refuse une valeur altérée ou une mauvaise clé", () => {
    const encrypted = encryptSecret("abc", rawKey);
    expect(() => decryptSecret({ ...encrypted, data: Buffer.from("xyz").toString("base64") }, rawKey)).toThrow();
    expect(() => decryptSecret(encrypted, randomBytes(32).toString("base64"))).toThrow();
  });

  it("refuse une clé de mauvaise taille", () => {
    expect(() => encryptSecret("abc", "trop-courte")).toThrow("32 octets");
  });

  it("vérifie les signatures", () => {
    const signature = sign("media:123:999", "secret");
    expect(verifySignature("media:123:999", signature, "secret")).toBe(true);
    expect(verifySignature("media:124:999", signature, "secret")).toBe(false);
  });
});

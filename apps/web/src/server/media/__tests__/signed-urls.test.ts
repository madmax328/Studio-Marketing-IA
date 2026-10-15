import { describe, expect, it } from "vitest";
import { signedMediaUrl, verifySignedMedia } from "@/server/media/signed-urls";

describe("liens temporaires vers les médias", () => {
  const now = Date.UTC(2030, 0, 1);
  const url = new URL(signedMediaUrl("https://app.example.fr/", "secret", "abc123", now));

  it("produit un lien valide deux heures", () => {
    expect(url.pathname).toBe("/api/medias/public/abc123");
    const exp = url.searchParams.get("exp");
    const sig = url.searchParams.get("sig");
    expect(verifySignedMedia("secret", "abc123", exp, sig, now)).toBe(true);
    expect(verifySignedMedia("secret", "abc123", exp, sig, now + 3 * 3600_000)).toBe(false);
  });

  it("refuse un autre média, une signature modifiée ou une autre clé", () => {
    const exp = url.searchParams.get("exp");
    const sig = url.searchParams.get("sig");
    expect(verifySignedMedia("secret", "autre", exp, sig, now)).toBe(false);
    expect(verifySignedMedia("secret", "abc123", exp, `${sig}x`, now)).toBe(false);
    expect(verifySignedMedia("autre-secret", "abc123", exp, sig, now)).toBe(false);
  });
});

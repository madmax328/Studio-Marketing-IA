import { describe, expect, it } from "vitest";
import { authErrorMessage } from "@/lib/auth-errors";

describe("authErrorMessage", () => {
  it("traduit les codes connus", () => {
    expect(authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD" })).toBe("E-mail ou mot de passe incorrect.");
  });
  it("signale la limitation de débit", () => {
    expect(authErrorMessage({ status: 429 })).toContain("Trop de tentatives");
  });
  it("ne divulgue pas les codes inconnus", () => {
    expect(authErrorMessage({ code: "SOMETHING_INTERNAL" })).toBe("Une erreur est survenue. Réessayez dans un instant.");
  });
});

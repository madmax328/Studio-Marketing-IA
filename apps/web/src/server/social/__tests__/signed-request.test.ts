import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseSignedRequest } from "../signed-request";

function sign(payload: object, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${createHmac("sha256", secret).update(body).digest("base64url")}.${body}`;
}

describe("signed_request Meta", () => {
  it("accepte une requête signée avec le bon secret", () => {
    expect(parseSignedRequest(sign({ algorithm: "HMAC-SHA256", user_id: "123", issued_at: 1700000000 }, "secret"), "secret")).toEqual({
      userId: "123",
      issuedAt: 1700000000,
    });
  });

  it("refuse une signature fausse, un contenu modifié ou un format invalide", () => {
    const valid = sign({ algorithm: "HMAC-SHA256", user_id: "123" }, "secret");
    expect(parseSignedRequest(valid, "autre-secret")).toBeNull();
    const [signature] = valid.split(".");
    const tampered = `${signature}.${Buffer.from(JSON.stringify({ algorithm: "HMAC-SHA256", user_id: "999" })).toString("base64url")}`;
    expect(parseSignedRequest(tampered, "secret")).toBeNull();
    expect(parseSignedRequest("pas-de-point", "secret")).toBeNull();
    expect(parseSignedRequest(sign({ algorithm: "HMAC-SHA256" }, "secret"), "secret")).toBeNull();
  });
});

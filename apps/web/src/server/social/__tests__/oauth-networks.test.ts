import { describe, expect, it } from "vitest";
import { fakeFetch } from "@/test/fake-fetch";
import { OAuthExchangeError } from "../oauth";
import { createGoogleBusinessOAuth, createYouTubeOAuth } from "../oauth-google";
import { createPinterestOAuth } from "../oauth-pinterest";
import { createTikTokOAuth } from "../oauth-tiktok";
import { createXOAuth } from "../oauth-x";

const now = new Date("2030-01-01T00:00:00Z");
const hour = 3600_000;

describe("connexion TikTok", () => {
  const config = { clientKey: "KEY", clientSecret: "SECRET" };

  it("échange le code : identifiant, nom d'utilisateur, jeton de 24 h et jeton de renouvellement", async () => {
    const fetch = fakeFetch([
      { match: "/oauth/token/", replies: [{ body: { access_token: "acc", refresh_token: "ref", open_id: "OID", expires_in: 86400, scope: "user.info.basic,video.publish" } }] },
      { match: "/user/info/", replies: [{ body: { data: { user: { username: "studio", display_name: "Studio" } }, error: { code: "ok" } } }] },
    ]);
    const [candidate] = await createTikTokOAuth({ ...config, fetch: fetch.impl }).exchange({ code: "C", redirectUri: "r", now });
    expect(candidate).toMatchObject({ network: "tiktok", externalAccountId: "OID", displayName: "@studio", accessToken: "acc", refreshToken: "ref" });
    expect(candidate?.tokenExpiresAt?.getTime()).toBe(now.getTime() + 24 * hour);
    expect(new URLSearchParams(fetch.calls[0]?.body ?? "").get("client_key")).toBe("KEY");
  });

  it("un code d'erreur TikTok (même avec un statut 200) est un refus", async () => {
    const fetch = fakeFetch([
      { match: "/oauth/token/", replies: [{ body: { access_token: "acc", open_id: "OID" } }] },
      { match: "/user/info/", replies: [{ body: { error: { code: "access_token_invalid", message: "invalide" } } }] },
    ]);
    await expect(createTikTokOAuth({ ...config, fetch: fetch.impl }).exchange({ code: "C", redirectUri: "r", now })).rejects.toBeInstanceOf(OAuthExchangeError);
  });
});

describe("connexion Google (YouTube, Business Profile)", () => {
  const config = { clientId: "CID", clientSecret: "SECRET" };

  it("demande un accès durable et propose les chaînes YouTube", async () => {
    const url = new URL(createYouTubeOAuth(config).authorizeUrl({ state: "s", redirectUri: "r" }));
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("scope")).toContain("youtube.upload");
    const fetch = fakeFetch([
      { match: "oauth2.googleapis.com/token", replies: [{ body: { access_token: "acc", refresh_token: "ref", expires_in: 3599 } }] },
      { match: "/youtube/v3/channels", replies: [{ body: { items: [{ id: "UC1", snippet: { title: "Ma chaîne" } }] } }] },
    ]);
    const candidates = await createYouTubeOAuth({ ...config, fetch: fetch.impl }).exchange({ code: "C", redirectUri: "r", now });
    expect(candidates).toEqual([expect.objectContaining({ network: "youtube", externalAccountId: "UC1", displayName: "Ma chaîne", refreshToken: "ref" })]);
  });

  it("sans jeton de renouvellement, la connexion est refusée (elle ne tiendrait qu'une heure)", async () => {
    const fetch = fakeFetch([{ match: "oauth2.googleapis.com/token", replies: [{ body: { access_token: "acc", expires_in: 3599 } }] }]);
    await expect(createYouTubeOAuth({ ...config, fetch: fetch.impl }).exchange({ code: "C", redirectUri: "r", now })).rejects.toThrow(/accès durable/);
  });

  it("propose chaque établissement Google Business Profile, avec son chemin complet", async () => {
    const fetch = fakeFetch([
      { match: "oauth2.googleapis.com/token", replies: [{ body: { access_token: "acc", refresh_token: "ref", expires_in: 3599 } }] },
      { match: "/v1/accounts?", replies: [{ body: { accounts: [{ name: "accounts/1" }] } }] },
      { match: "/accounts/1/locations", replies: [{ body: { locations: [{ name: "locations/9", title: "Boulangerie", storefrontAddress: { locality: "Lyon" } }] } }] },
    ]);
    const candidates = await createGoogleBusinessOAuth({ ...config, fetch: fetch.impl }).exchange({ code: "C", redirectUri: "r", now });
    expect(candidates).toEqual([expect.objectContaining({ network: "google_business", externalAccountId: "accounts/1/locations/9", displayName: "Boulangerie (Lyon)" })]);
  });

  it("renouvellement : refus définitif (accès retiré) ou panne passagère", async () => {
    const revoked = fakeFetch([{ match: "/token", replies: [{ status: 400, body: { error: "invalid_grant", error_description: "Token has been expired or revoked." } }] }]);
    await expect(createYouTubeOAuth({ ...config, fetch: revoked.impl }).refresh?.("ref", now)).rejects.toMatchObject({ temporary: false });
    const down = fakeFetch([{ match: "/token", replies: [{ status: 503 }] }]);
    await expect(createYouTubeOAuth({ ...config, fetch: down.impl }).refresh?.("ref", now)).rejects.toMatchObject({ temporary: true });
  });
});

describe("connexion Pinterest", () => {
  it("chaque tableau devient une destination ; authentification Basic de l'application", async () => {
    const fetch = fakeFetch([
      { match: "/oauth/token", replies: [{ body: { access_token: "acc", refresh_token: "ref", expires_in: 2592000 } }] },
      { match: "/user_account", replies: [{ body: { username: "atelier" } }] },
      { match: "/boards", replies: [{ body: { items: [{ id: "B1", name: "Recettes" }, { id: "B2", name: "Atelier" }] } }] },
    ]);
    const candidates = await createPinterestOAuth({ appId: "APP", appSecret: "SECRET", fetch: fetch.impl }).exchange({ code: "C", redirectUri: "r", now });
    expect(candidates.map((c) => [c.externalAccountId, c.displayName])).toEqual([
      ["B1", "Recettes (@atelier)"],
      ["B2", "Atelier (@atelier)"],
    ]);
    expect(fetch.calls[0]?.headers.authorization).toBe(`Basic ${Buffer.from("APP:SECRET").toString("base64")}`);
  });
});

describe("connexion X", () => {
  const config = { clientId: "CID", clientSecret: "SECRET" };

  it("exige PKCE et transmet le vérificateur à l'échange", async () => {
    const provider = createXOAuth(config);
    expect(provider.pkce).toBe(true);
    const url = new URL(provider.authorizeUrl({ state: "s", redirectUri: "r", codeChallenge: "defi" }));
    expect(url.searchParams.get("code_challenge")).toBe("defi");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toContain("offline.access");

    const fetch = fakeFetch([
      { match: "/oauth2/token", replies: [{ body: { access_token: "acc", refresh_token: "ref", expires_in: 7200 } }] },
      { match: "/users/me", replies: [{ body: { data: { id: "42", username: "atelier" } } }] },
    ]);
    const [candidate] = await createXOAuth({ ...config, fetch: fetch.impl }).exchange({ code: "C", redirectUri: "r", now, codeVerifier: "verif" });
    expect(candidate).toMatchObject({ externalAccountId: "42", displayName: "@atelier", refreshToken: "ref" });
    expect(new URLSearchParams(fetch.calls[0]?.body ?? "").get("code_verifier")).toBe("verif");
    await expect(createXOAuth(config).exchange({ code: "C", redirectUri: "r", now })).rejects.toBeInstanceOf(OAuthExchangeError);
  });

  it("le renouvellement renvoie le nouveau jeton de renouvellement (l'ancien devient invalide)", async () => {
    const fetch = fakeFetch([{ match: "/oauth2/token", replies: [{ body: { access_token: "acc2", refresh_token: "ref2", expires_in: 7200 } }] }]);
    expect(await createXOAuth({ ...config, fetch: fetch.impl }).refresh?.("ref", now)).toEqual({
      accessToken: "acc2",
      refreshToken: "ref2",
      tokenExpiresAt: new Date(now.getTime() + 2 * hour),
    });
  });
});

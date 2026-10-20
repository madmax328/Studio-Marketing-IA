import { describe, expect, it } from "vitest";
import { fakeFetch } from "@/test/fake-fetch";
import { createLinkedInOAuth, createMetaOAuth, createThreadsOAuth, OAuthExchangeError, refreshThreadsToken } from "../oauth";

const now = new Date("2030-01-01T00:00:00Z");

describe("connexion Meta", () => {
  const config = { appId: "APP", appSecret: "SECRET", graphVersion: "v24.0" };

  it("adresse d'autorisation : état, retour et permissions demandées", () => {
    const url = new URL(createMetaOAuth(config).authorizeUrl({ state: "etat", redirectUri: "https://app.test/api/reseaux/retour/meta" }));
    expect(url.origin + url.pathname).toBe("https://www.facebook.com/v24.0/dialog/oauth");
    expect(url.searchParams.get("state")).toBe("etat");
    expect(url.searchParams.get("scope")).toContain("pages_manage_posts");
    expect(url.searchParams.get("scope")).toContain("instagram_content_publish");
    expect(url.toString()).not.toContain("SECRET");
  });

  it("échange le code, passe en jeton longue durée et propose Pages et comptes Instagram liés", async () => {
    const fetch = fakeFetch([
      { match: "/oauth/access_token", replies: [{ body: { access_token: "court" } }, { body: { access_token: "long" } }] },
      { match: "/me/permissions", replies: [{ body: { data: [{ permission: "pages_manage_posts", status: "granted" }, { permission: "read_insights", status: "declined" }] } }] },
      {
        match: "/me/accounts",
        replies: [
          {
            body: {
              data: [
                { id: "P1", name: "Boulangerie", access_token: "jeton-p1", instagram_business_account: { id: "IG1", username: "boulangerie" } },
                { id: "P2", name: "Sans Instagram", access_token: "jeton-p2" },
              ],
            },
          },
        ],
      },
    ]);
    const candidates = await createMetaOAuth({ ...config, fetch: fetch.impl }).exchange({ code: "CODE", redirectUri: "https://app.test/r", now });
    expect(candidates.map((c) => [c.network, c.externalAccountId, c.displayName, c.accessToken])).toEqual([
      ["facebook", "P1", "Boulangerie", "jeton-p1"],
      ["instagram", "IG1", "@boulangerie (Page Boulangerie)", "jeton-p1"],
      ["facebook", "P2", "Sans Instagram", "jeton-p2"],
    ]);
    expect(candidates[0]?.scopes).toEqual(["pages_manage_posts"]);
    // Le secret part dans le corps de la requête, jamais dans l'adresse.
    expect(fetch.calls.every((call) => !call.url.includes("SECRET"))).toBe(true);
    expect(new URLSearchParams(fetch.calls[1]?.body ?? "").get("grant_type")).toBe("fb_exchange_token");
    expect(fetch.calls[2]?.headers.authorization).toBe("Bearer long");
  });

  it("aucune Page partagée → message clair", async () => {
    const fetch = fakeFetch([
      { match: "/oauth/access_token", replies: [{ body: { access_token: "t" } }] },
      { match: "/me/permissions", replies: [{ body: { data: [] } }] },
      { match: "/me/accounts", replies: [{ body: { data: [] } }] },
    ]);
    await expect(createMetaOAuth({ ...config, fetch: fetch.impl }).exchange({ code: "C", redirectUri: "r", now })).rejects.toThrow(/Aucune Page/);
  });

  it("code refusé → OAuthExchangeError", async () => {
    const fetch = fakeFetch([{ match: "/oauth/access_token", replies: [{ status: 400, body: { error: { message: "Code expired", code: 100 } } }] }]);
    await expect(createMetaOAuth({ ...config, fetch: fetch.impl }).exchange({ code: "C", redirectUri: "r", now })).rejects.toBeInstanceOf(OAuthExchangeError);
  });
});

describe("connexion Threads", () => {
  it("jeton longue durée avec date d'expiration, et renouvellement", async () => {
    const fetch = fakeFetch([
      { match: "graph.threads.net/oauth/access_token", replies: [{ body: { access_token: "court", user_id: 1 } }] },
      { match: "th_exchange_token", replies: [{ body: { access_token: "long", expires_in: 5_184_000 } }] },
      { match: "/me?fields", replies: [{ body: { id: "TH1", username: "moi" } }] },
      { match: "th_refresh_token", replies: [{ body: { access_token: "neuf", expires_in: 100 } }] },
    ]);
    const [candidate] = await createThreadsOAuth({ appId: "A", appSecret: "S", fetch: fetch.impl }).exchange({ code: "C", redirectUri: "r", now });
    expect(candidate).toMatchObject({ network: "threads", externalAccountId: "TH1", displayName: "@moi", accessToken: "long" });
    expect(candidate?.tokenExpiresAt?.toISOString()).toBe("2030-03-02T00:00:00.000Z");
    const refreshed = await refreshThreadsToken(fetch.impl, "long", now);
    expect(refreshed.accessToken).toBe("neuf");
  });
});

describe("connexion LinkedIn", () => {
  it("profil du membre : identifiant urn, nom, expiration", async () => {
    const fetch = fakeFetch([
      { match: "/oauth/v2/accessToken", replies: [{ body: { access_token: "t", expires_in: 3600, scope: "openid,profile,w_member_social" } }] },
      { match: "/v2/userinfo", replies: [{ body: { sub: "abc", name: "Alice Martin" } }] },
    ]);
    const provider = createLinkedInOAuth({ clientId: "ID", clientSecret: "S", fetch: fetch.impl });
    const [candidate] = await provider.exchange({ code: "C", redirectUri: "r", now });
    expect(candidate).toMatchObject({
      network: "linkedin",
      externalAccountId: "urn:li:person:abc",
      displayName: "Alice Martin",
      scopes: ["openid", "profile", "w_member_social"],
    });
    expect(candidate?.tokenExpiresAt?.toISOString()).toBe("2030-01-01T01:00:00.000Z");
    expect(new URL(provider.authorizeUrl({ state: "s", redirectUri: "r" })).searchParams.get("scope")).toBe("openid profile w_member_social");
  });
});

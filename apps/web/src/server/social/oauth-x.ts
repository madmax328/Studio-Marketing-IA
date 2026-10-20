import { form, isRecord, stringField, type FetchLike } from "./http";
import { call, expiresIn, OAuthExchangeError, requireToken, type OAuthProvider, type RefreshedToken } from "./oauth";

export const X_SCOPES = ["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"] as const;
export const X_API_URL = "https://api.x.com/2";

/**
 * X (OAuth 2.0 avec PKCE). Jeton d'accès de 2 heures ; le jeton de renouvellement change à chaque
 * renouvellement (l'ancien devient invalide).
 */
export function createXOAuth(config: { clientId: string; clientSecret: string; fetch?: FetchLike }): OAuthProvider {
  const fetchImpl = config.fetch ?? fetch;
  const label = "X";
  const basic = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;
  const token = (values: Record<string, string>) =>
    call(label, fetchImpl, `${X_API_URL}/oauth2/token`, {
      method: "POST",
      headers: { Authorization: basic, "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ client_id: config.clientId, ...values }),
    });

  return {
    id: "x",
    label: "X",
    networks: ["x"],
    pkce: true,
    authorizeUrl({ state, redirectUri, codeChallenge }) {
      if (!codeChallenge) throw new Error("PKCE requis pour X.");
      const params = new URLSearchParams({
        response_type: "code",
        client_id: config.clientId,
        redirect_uri: redirectUri,
        scope: X_SCOPES.join(" "),
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });
      return `https://x.com/i/oauth2/authorize?${params}`;
    },
    async exchange({ code, redirectUri, now, codeVerifier }) {
      if (!codeVerifier) throw new OAuthExchangeError("La demande de connexion est incomplète. Recommencez.");
      const body = (await token({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: codeVerifier })).body;
      const accessToken = requireToken(label, body);
      const me = (await call(label, fetchImpl, `${X_API_URL}/users/me`, { headers: { Authorization: `Bearer ${accessToken}` } })).body;
      const user = isRecord(me) ? me.data : null;
      const id = stringField(user, "id");
      if (!id) throw new OAuthExchangeError("X n'a pas renvoyé l'identifiant du compte.");
      const username = stringField(user, "username");
      const scope = stringField(body, "scope");
      return [
        {
          network: "x",
          externalAccountId: id,
          displayName: username ? `@${username}` : "Compte X",
          scopes: scope ? scope.split(" ").filter(Boolean) : [...X_SCOPES],
          accessToken,
          refreshToken: stringField(body, "refresh_token"),
          tokenExpiresAt: expiresIn(body, now),
        },
      ];
    },
    async refresh(refreshToken, now): Promise<RefreshedToken> {
      const body = (await token({ grant_type: "refresh_token", refresh_token: refreshToken })).body;
      return { accessToken: requireToken(label, body), refreshToken: stringField(body, "refresh_token"), tokenExpiresAt: expiresIn(body, now) };
    },
  };
}

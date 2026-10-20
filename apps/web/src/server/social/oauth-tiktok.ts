import { form, isRecord, stringField, type FetchLike } from "./http";
import { call, expiresIn, OAuthExchangeError, requireToken, type OAuthProvider, type RefreshedToken } from "./oauth";

export const TIKTOK_SCOPES = ["user.info.basic", "user.info.profile", "video.publish", "video.upload", "video.list"] as const;
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";

/**
 * TikTok (Login Kit + Content Posting API). Jeton d'accès de 24 h, renouvelé automatiquement
 * grâce au jeton de renouvellement (valable un an).
 */
export function createTikTokOAuth(config: { clientKey: string; clientSecret: string; fetch?: FetchLike }): OAuthProvider {
  const fetchImpl = config.fetch ?? fetch;
  const label = "TikTok";
  const token = (values: Record<string, string>) =>
    call(label, fetchImpl, TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ client_key: config.clientKey, client_secret: config.clientSecret, ...values }),
    });

  return {
    id: "tiktok",
    label: "TikTok",
    networks: ["tiktok"],
    authorizeUrl({ state, redirectUri }) {
      const params = new URLSearchParams({
        client_key: config.clientKey,
        response_type: "code",
        scope: TIKTOK_SCOPES.join(","),
        redirect_uri: redirectUri,
        state,
      });
      return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
    },
    async exchange({ code, redirectUri, now }) {
      const body = (await token({ grant_type: "authorization_code", code, redirect_uri: redirectUri })).body;
      const accessToken = requireToken(label, body);
      const openId = stringField(body, "open_id");
      if (!openId) throw new OAuthExchangeError("TikTok n'a pas renvoyé l'identifiant du compte.");
      const info = (
        await call(label, fetchImpl, "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      ).body;
      const user = isRecord(info) && isRecord(info.data) ? info.data.user : null;
      const username = stringField(user, "username");
      const scope = stringField(body, "scope");
      return [
        {
          network: "tiktok",
          externalAccountId: openId,
          displayName: username ? `@${username}` : (stringField(user, "display_name") ?? "Compte TikTok"),
          scopes: scope ? scope.split(",").filter(Boolean) : [...TIKTOK_SCOPES],
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

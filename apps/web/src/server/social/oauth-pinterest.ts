import { form, isRecord, stringField, type FetchLike } from "./http";
import { call, expiresIn, OAuthExchangeError, requireToken, type OAuthProvider, type RefreshedToken } from "./oauth";

export const PINTEREST_SCOPES = ["boards:read", "pins:read", "pins:write", "user_accounts:read"] as const;
export const PINTEREST_API_URL = "https://api.pinterest.com/v5";

/**
 * Pinterest (API v5) : chaque tableau choisi devient une destination de publication.
 * Jeton d'accès de 30 jours, renouvelé automatiquement.
 */
export function createPinterestOAuth(config: { appId: string; appSecret: string; fetch?: FetchLike }): OAuthProvider {
  const fetchImpl = config.fetch ?? fetch;
  const label = "Pinterest";
  const basic = `Basic ${Buffer.from(`${config.appId}:${config.appSecret}`).toString("base64")}`;
  const token = (values: Record<string, string>) =>
    call(label, fetchImpl, `${PINTEREST_API_URL}/oauth/token`, {
      method: "POST",
      headers: { Authorization: basic, "Content-Type": "application/x-www-form-urlencoded" },
      body: form(values),
    });

  return {
    id: "pinterest",
    label: "Pinterest",
    networks: ["pinterest"],
    authorizeUrl({ state, redirectUri }) {
      const params = new URLSearchParams({ client_id: config.appId, redirect_uri: redirectUri, response_type: "code", scope: PINTEREST_SCOPES.join(","), state });
      return `https://www.pinterest.com/oauth/?${params}`;
    },
    async exchange({ code, redirectUri, now }) {
      const body = (await token({ grant_type: "authorization_code", code, redirect_uri: redirectUri })).body;
      const accessToken = requireToken(label, body);
      const auth = { headers: { Authorization: `Bearer ${accessToken}` } };
      const user = (await call(label, fetchImpl, `${PINTEREST_API_URL}/user_account`, auth)).body;
      const username = stringField(user, "username");
      const boardsBody = (await call(label, fetchImpl, `${PINTEREST_API_URL}/boards?page_size=100`, auth)).body;
      const boards = isRecord(boardsBody) && Array.isArray(boardsBody.items) ? boardsBody.items : [];
      const scope = stringField(body, "scope");
      const candidates = boards.flatMap((board) => {
        const id = stringField(board, "id");
        if (!id) return [];
        const name = stringField(board, "name") ?? "Tableau";
        return [
          {
            network: "pinterest" as const,
            externalAccountId: id,
            displayName: username ? `${name} (@${username})` : name,
            scopes: scope ? scope.split(/[ ,]+/).filter(Boolean) : [...PINTEREST_SCOPES],
            accessToken,
            refreshToken: stringField(body, "refresh_token"),
            tokenExpiresAt: expiresIn(body, now),
          },
        ];
      });
      if (candidates.length === 0) throw new OAuthExchangeError("Aucun tableau Pinterest trouvé. Créez d'abord un tableau sur Pinterest pour y publier.");
      return candidates;
    },
    async refresh(refreshToken, now): Promise<RefreshedToken> {
      const body = (await token({ grant_type: "refresh_token", refresh_token: refreshToken })).body;
      return { accessToken: requireToken(label, body), refreshToken: stringField(body, "refresh_token"), tokenExpiresAt: expiresIn(body, now) };
    },
  };
}

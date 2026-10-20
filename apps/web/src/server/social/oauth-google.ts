import type { SocialNetworkId } from "@smia/shared";
import type { OAuthProviderId } from "@/server/db/collections";
import { form, isRecord, stringField, type FetchLike } from "./http";
import { call, expiresIn, OAuthExchangeError, requireToken, type OAuthCandidate, type OAuthProvider, type RefreshedToken } from "./oauth";

export const YOUTUBE_SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"] as const;
export const GOOGLE_BUSINESS_SCOPES = ["https://www.googleapis.com/auth/business.manage"] as const;
const TOKEN_URL = "https://oauth2.googleapis.com/token";

interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  fetch?: FetchLike;
}

/**
 * Socle commun aux connexions Google (YouTube, Google Business Profile) : jeton d'accès d'une heure,
 * jeton de renouvellement demandé (access_type=offline) et renouvellement automatique.
 */
function createGoogleOAuth(
  config: GoogleConfig,
  options: {
    id: OAuthProviderId;
    label: string;
    networks: readonly SocialNetworkId[];
    scopes: readonly string[];
    accounts: (accessToken: string, fetchImpl: FetchLike) => Promise<Omit<OAuthCandidate, "accessToken" | "refreshToken" | "tokenExpiresAt" | "scopes">[]>;
  },
): OAuthProvider {
  const fetchImpl = config.fetch ?? fetch;
  const token = (values: Record<string, string>) =>
    call(options.label, fetchImpl, TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ client_id: config.clientId, client_secret: config.clientSecret, ...values }),
    });

  return {
    id: options.id,
    label: options.label,
    networks: options.networks,
    authorizeUrl({ state, redirectUri }) {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: options.scopes.join(" "),
        access_type: "offline",
        // Redemande l'accord pour obtenir à coup sûr un jeton de renouvellement.
        prompt: "consent",
        include_granted_scopes: "true",
        state,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    },
    async exchange({ code, redirectUri, now }) {
      const body = (await token({ grant_type: "authorization_code", code, redirect_uri: redirectUri })).body;
      const accessToken = requireToken(options.label, body);
      const refreshToken = stringField(body, "refresh_token");
      if (!refreshToken) throw new OAuthExchangeError(`${options.label} n'a pas fourni d'accès durable. Recommencez la connexion.`);
      const scope = stringField(body, "scope");
      const accounts = await options.accounts(accessToken, fetchImpl);
      return accounts.map((account) => ({
        ...account,
        scopes: scope ? scope.split(" ").filter(Boolean) : [...options.scopes],
        accessToken,
        refreshToken,
        tokenExpiresAt: expiresIn(body, now),
      }));
    },
    async refresh(refreshToken, now): Promise<RefreshedToken> {
      const body = (await token({ grant_type: "refresh_token", refresh_token: refreshToken })).body;
      return { accessToken: requireToken(options.label, body), refreshToken: stringField(body, "refresh_token"), tokenExpiresAt: expiresIn(body, now) };
    },
  };
}

/** YouTube : une chaîne par compte Google (ou plusieurs chaînes de marque). */
export function createYouTubeOAuth(config: GoogleConfig): OAuthProvider {
  return createGoogleOAuth(config, {
    id: "youtube",
    label: "YouTube",
    networks: ["youtube"],
    scopes: YOUTUBE_SCOPES,
    async accounts(accessToken, fetchImpl) {
      const body = (
        await call("YouTube", fetchImpl, "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      ).body;
      const channels = isRecord(body) && Array.isArray(body.items) ? body.items : [];
      const accounts = channels.flatMap((channel) => {
        const id = stringField(channel, "id");
        const snippet = isRecord(channel) ? channel.snippet : null;
        return id ? [{ network: "youtube" as const, externalAccountId: id, displayName: stringField(snippet, "title") ?? "Chaîne YouTube" }] : [];
      });
      if (accounts.length === 0) throw new OAuthExchangeError("Aucune chaîne YouTube n'est liée à ce compte Google. Créez d'abord votre chaîne sur YouTube.");
      return accounts;
    },
  });
}

/** Google Business Profile : chaque établissement (fiche) géré par le compte Google. */
export function createGoogleBusinessOAuth(config: GoogleConfig): OAuthProvider {
  return createGoogleOAuth(config, {
    id: "google_business",
    label: "Google Business Profile",
    networks: ["google_business"],
    scopes: GOOGLE_BUSINESS_SCOPES,
    async accounts(accessToken, fetchImpl) {
      const auth = { headers: { Authorization: `Bearer ${accessToken}` } };
      const label = "Google Business Profile";
      const accountsBody = (await call(label, fetchImpl, "https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20", auth)).body;
      const businessAccounts = isRecord(accountsBody) && Array.isArray(accountsBody.accounts) ? accountsBody.accounts : [];
      const result: { network: "google_business"; externalAccountId: string; displayName: string }[] = [];
      for (const account of businessAccounts) {
        const accountName = stringField(account, "name");
        if (!accountName) continue;
        const params = new URLSearchParams({ readMask: "name,title,storefrontAddress", pageSize: "100" });
        const locationsBody = (await call(label, fetchImpl, `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?${params}`, auth)).body;
        for (const location of isRecord(locationsBody) && Array.isArray(locationsBody.locations) ? locationsBody.locations : []) {
          const locationName = stringField(location, "name");
          if (!locationName) continue;
          const address = isRecord(location) ? location.storefrontAddress : null;
          const city = stringField(address, "locality");
          const title = stringField(location, "title") ?? "Établissement";
          // L'API des publications attend « accounts/…/locations/… ».
          result.push({ network: "google_business", externalAccountId: `${accountName}/${locationName}`, displayName: city ? `${title} (${city})` : title });
        }
      }
      if (result.length === 0) throw new OAuthExchangeError("Aucun établissement n'est géré par ce compte Google. Vérifiez votre fiche Google Business Profile.");
      return result;
    },
  });
}

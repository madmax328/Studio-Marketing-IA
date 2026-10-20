import type { SocialNetworkId } from "@smia/shared";
import type { OAuthProviderId } from "@/server/db/collections";
import { THREADS_GRAPH_URL } from "@/server/publishing/publishers/threads";
import { apiErrorMessage, callApi, form, isRecord, NetworkFailure, numberField, stringField, type ApiResponse, type FetchLike } from "./http";

/** Compte obtenu après l'autorisation, avant le choix de l'utilisateur. Le jeton est en clair : à chiffrer aussitôt. */
export interface OAuthCandidate {
  network: SocialNetworkId;
  externalAccountId: string;
  displayName: string;
  scopes: string[];
  accessToken: string;
  /** Jeton de renouvellement, pour les réseaux dont le jeton d'accès dure peu (en clair : à chiffrer aussitôt). */
  refreshToken?: string | null;
  tokenExpiresAt: Date | null;
}

/** Jeton renouvelé. Un nouveau jeton de renouvellement remplace l'ancien quand le réseau en fournit un (X). */
export interface RefreshedToken {
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt: Date | null;
}

export interface OAuthProvider {
  id: OAuthProviderId;
  label: string;
  networks: readonly SocialNetworkId[];
  /** Le réseau exige PKCE (code_challenge S256). */
  pkce?: boolean;
  authorizeUrl(params: { state: string; redirectUri: string; codeChallenge?: string | null }): string;
  exchange(params: { code: string; redirectUri: string; now: Date; codeVerifier?: string | null }): Promise<OAuthCandidate[]>;
  /** Renouvelle le jeton d'accès à partir du jeton de renouvellement. */
  refresh?(refreshToken: string, now: Date): Promise<RefreshedToken>;
}

/** Échec de l'échange d'autorisation ; le message peut être affiché. */
export class OAuthExchangeError extends Error {
  constructor(
    message: string,
    /** Panne passagère (réseau injoignable, surcharge) plutôt que refus : on pourra réessayer. */
    readonly temporary = false,
  ) {
    super(message);
    this.name = "OAuthExchangeError";
  }
}

/** Fournisseur de connexion de chaque réseau (null : pas encore de connecteur). */
export const NETWORK_OAUTH_PROVIDER: Record<SocialNetworkId, OAuthProviderId | null> = {
  facebook: "meta",
  instagram: "meta",
  threads: "threads",
  linkedin: "linkedin",
  tiktok: "tiktok",
  youtube: "youtube",
  x: "x",
  pinterest: "pinterest",
  google_business: "google_business",
};

/** Fournisseurs à jeton d'accès court, renouvelé automatiquement par le planificateur. */
export const REFRESHABLE_PROVIDERS: readonly OAuthProviderId[] = ["tiktok", "youtube", "pinterest", "x", "google_business"];

/** Durée laissée pour autoriser l'application sur la page du réseau. */
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;

export const OAUTH_PROVIDER_IDS: readonly OAuthProviderId[] = ["meta", "threads", "linkedin", "tiktok", "youtube", "pinterest", "x", "google_business"];

export function isOAuthProviderId(value: string): value is OAuthProviderId {
  return (OAUTH_PROVIDER_IDS as readonly string[]).includes(value);
}

/** Pages, publication, statistiques (étape 6). Chaque permission doit être validée par Meta (App Review). */
export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "read_insights",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
] as const;
export const THREADS_SCOPES = ["threads_basic", "threads_content_publish", "threads_manage_insights"] as const;
export const LINKEDIN_SCOPES = ["openid", "profile", "w_member_social"] as const;

export async function call(label: string, fetchImpl: FetchLike, url: string, init: RequestInit = {}): Promise<ApiResponse> {
  let response: ApiResponse;
  try {
    response = await callApi(fetchImpl, url, init);
  } catch (error) {
    if (error instanceof NetworkFailure) throw new OAuthExchangeError(`${label} n'a pas répondu. Réessayez dans un instant.`, true);
    throw error;
  }
  // TikTok renvoie toujours un objet `error`, avec le code « ok » en cas de succès.
  const error = isRecord(response.body) && isRecord(response.body.error) ? response.body.error : null;
  if (response.status >= 400 || (error && stringField(error, "code") !== "ok")) {
    const detail = apiErrorMessage(response.body);
    throw new OAuthExchangeError(`${label} a refusé la connexion${detail ? ` (${detail})` : ""}.`, response.status === 429 || response.status >= 500);
  }
  return response;
}

export const expiresIn = (body: unknown, now: Date): Date | null => {
  const seconds = numberField(body, "expires_in");
  return seconds && seconds > 0 ? new Date(now.getTime() + seconds * 1000) : null;
};

export function requireToken(label: string, body: unknown): string {
  const token = stringField(body, "access_token");
  if (!token) throw new OAuthExchangeError(`${label} n'a pas renvoyé de jeton d'accès.`);
  return token;
}

/**
 * Facebook Login : un seul accord donne accès aux Pages Facebook choisies par l'utilisateur
 * et aux comptes Instagram professionnels qui leur sont liés.
 */
export function createMetaOAuth(config: { appId: string; appSecret: string; graphVersion: string; fetch?: FetchLike }): OAuthProvider {
  const fetchImpl = config.fetch ?? fetch;
  const base = `https://graph.facebook.com/${config.graphVersion}`;
  const label = "Meta";
  const tokenRequest = (values: Record<string, string>) =>
    call(label, fetchImpl, `${base}/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ client_id: config.appId, client_secret: config.appSecret, ...values }),
    });

  return {
    id: "meta",
    label: "Facebook et Instagram",
    networks: ["facebook", "instagram"],
    authorizeUrl({ state, redirectUri }) {
      const params = new URLSearchParams({
        client_id: config.appId,
        redirect_uri: redirectUri,
        state,
        response_type: "code",
        scope: META_SCOPES.join(","),
      });
      return `https://www.facebook.com/${config.graphVersion}/dialog/oauth?${params}`;
    },
    async exchange({ code, redirectUri }) {
      const shortLived = requireToken(label, (await tokenRequest({ code, redirect_uri: redirectUri })).body);
      // Jeton utilisateur longue durée : les jetons de Page qui en découlent n'expirent pas.
      const userToken = requireToken(label, (await tokenRequest({ grant_type: "fb_exchange_token", fb_exchange_token: shortLived })).body);
      const auth = { headers: { Authorization: `Bearer ${userToken}` } };

      const permissions = (await call(label, fetchImpl, `${base}/me/permissions`, auth)).body;
      const granted = (isRecord(permissions) && Array.isArray(permissions.data) ? permissions.data : [])
        .filter((item) => stringField(item, "status") === "granted")
        .flatMap((item) => stringField(item, "permission") ?? []);

      const fields = new URLSearchParams({ fields: "id,name,access_token,instagram_business_account{id,username}", limit: "100" });
      const pages = (await call(label, fetchImpl, `${base}/me/accounts?${fields}`, auth)).body;
      const candidates: OAuthCandidate[] = [];
      for (const page of isRecord(pages) && Array.isArray(pages.data) ? pages.data : []) {
        const id = stringField(page, "id");
        const token = stringField(page, "access_token");
        if (!id || !token) continue;
        const name = stringField(page, "name") ?? "Page Facebook";
        candidates.push({ network: "facebook", externalAccountId: id, displayName: name, scopes: granted, accessToken: token, tokenExpiresAt: null });
        const instagram = isRecord(page) ? page.instagram_business_account : null;
        const igId = stringField(instagram, "id");
        if (igId) {
          const username = stringField(instagram, "username");
          candidates.push({
            network: "instagram",
            externalAccountId: igId,
            displayName: username ? `@${username} (Page ${name})` : `Instagram de la Page ${name}`,
            scopes: granted,
            accessToken: token,
            tokenExpiresAt: null,
          });
        }
      }
      if (candidates.length === 0) {
        throw new OAuthExchangeError(
          "Aucune Page Facebook n'a été partagée. Recommencez en sélectionnant au moins une Page (et le compte Instagram qui lui est lié).",
        );
      }
      return candidates;
    },
  };
}

/** Threads : autorisation propre (threads.net), jeton longue durée de 60 jours, renouvelable. */
export function createThreadsOAuth(config: { appId: string; appSecret: string; fetch?: FetchLike }): OAuthProvider {
  const fetchImpl = config.fetch ?? fetch;
  const label = "Threads";
  return {
    id: "threads",
    label: "Threads",
    networks: ["threads"],
    authorizeUrl({ state, redirectUri }) {
      const params = new URLSearchParams({
        client_id: config.appId,
        redirect_uri: redirectUri,
        state,
        response_type: "code",
        scope: THREADS_SCOPES.join(","),
      });
      return `https://threads.net/oauth/authorize?${params}`;
    },
    async exchange({ code, redirectUri, now }) {
      const shortLived = requireToken(
        label,
        (
          await call(label, fetchImpl, "https://graph.threads.net/oauth/access_token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: form({ client_id: config.appId, client_secret: config.appSecret, grant_type: "authorization_code", redirect_uri: redirectUri, code }),
          })
        ).body,
      );
      const exchangeParams = new URLSearchParams({ grant_type: "th_exchange_token", client_secret: config.appSecret, access_token: shortLived });
      const longLived = (await call(label, fetchImpl, `https://graph.threads.net/access_token?${exchangeParams}`)).body;
      const token = requireToken(label, longLived);
      const me = (await call(label, fetchImpl, `${THREADS_GRAPH_URL}/me?fields=id,username`, { headers: { Authorization: `Bearer ${token}` } })).body;
      const id = stringField(me, "id");
      if (!id) throw new OAuthExchangeError("Threads n'a pas renvoyé l'identifiant du compte.");
      const username = stringField(me, "username");
      return [
        {
          network: "threads",
          externalAccountId: id,
          displayName: username ? `@${username}` : "Compte Threads",
          scopes: [...THREADS_SCOPES],
          accessToken: token,
          tokenExpiresAt: expiresIn(longLived, now),
        },
      ];
    },
  };
}

/** Renouvelle un jeton Threads longue durée (possible dès qu'il a plus de 24 heures). */
export async function refreshThreadsToken(fetchImpl: FetchLike, token: string, now: Date): Promise<{ accessToken: string; tokenExpiresAt: Date | null }> {
  const params = new URLSearchParams({ grant_type: "th_refresh_token", access_token: token });
  const body = (await call("Threads", fetchImpl, `https://graph.threads.net/refresh_access_token?${params}`)).body;
  return { accessToken: requireToken("Threads", body), tokenExpiresAt: expiresIn(body, now) };
}

/**
 * LinkedIn : profil personnel du membre (produits « Sign In with LinkedIn using OpenID Connect »
 * et « Share on LinkedIn »). Jeton de 60 jours, sans renouvellement automatique pour ces produits.
 */
export function createLinkedInOAuth(config: { clientId: string; clientSecret: string; fetch?: FetchLike }): OAuthProvider {
  const fetchImpl = config.fetch ?? fetch;
  const label = "LinkedIn";
  return {
    id: "linkedin",
    label: "LinkedIn",
    networks: ["linkedin"],
    authorizeUrl({ state, redirectUri }) {
      const params = new URLSearchParams({
        response_type: "code",
        client_id: config.clientId,
        redirect_uri: redirectUri,
        state,
        scope: LINKEDIN_SCOPES.join(" "),
      });
      return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
    },
    async exchange({ code, redirectUri, now }) {
      const tokenBody = (
        await call(label, fetchImpl, "https://www.linkedin.com/oauth/v2/accessToken", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form({ grant_type: "authorization_code", code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: redirectUri }),
        })
      ).body;
      const token = requireToken(label, tokenBody);
      const me = (await call(label, fetchImpl, "https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${token}` } })).body;
      const sub = stringField(me, "sub");
      if (!sub) throw new OAuthExchangeError("LinkedIn n'a pas renvoyé l'identifiant du membre.");
      const scope = stringField(tokenBody, "scope");
      return [
        {
          network: "linkedin",
          externalAccountId: `urn:li:person:${sub}`,
          displayName: stringField(me, "name") ?? "Profil LinkedIn",
          scopes: scope ? scope.split(/[ ,]+/).filter(Boolean) : [...LINKEDIN_SCOPES],
          accessToken: token,
          tokenExpiresAt: expiresIn(tokenBody, now),
        },
      ];
    },
  };
}

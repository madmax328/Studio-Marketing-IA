import { NextResponse } from "next/server";
import { getDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import { UserFacingError } from "@/server/services/errors";
import { startOAuthConnection } from "@/server/services/social-connections";
import { getWorkspaceForApi } from "@/server/session";
import { getOAuthProvider, oauthRedirectUri } from "@/server/social";
import { OAUTH_COOKIE_PATH, OAUTH_STATE_COOKIE } from "@/server/social/cookies";
import { isOAuthProviderId, OAUTH_STATE_TTL_SECONDS } from "@/server/social/oauth";

/**
 * Lance la connexion d'un compte : redirige vers la page officielle du réseau.
 * Nous ne voyons jamais le mot de passe du compte.
 */
export async function GET(_request: Request, context: RouteContext<"/api/reseaux/connexion/[provider]">): Promise<Response> {
  const { provider } = await context.params;
  const env = getServerEnv();
  const back = (code: string) => NextResponse.redirect(new URL(`/reseaux?connexion=${code}`, env.APP_URL), 303);

  if (!isOAuthProviderId(provider)) return back("inconnu");
  const access = await getWorkspaceForApi();
  if (!access) return NextResponse.redirect(new URL("/connexion", env.APP_URL), 303);
  const oauth = getOAuthProvider(provider);
  if (!oauth) return back("indisponible");

  let state: string;
  let codeChallenge: string | null;
  try {
    ({ state, codeChallenge } = await startOAuthConnection(getDb(), access, access.userId, provider, new Date(), { pkce: oauth.pkce }));
  } catch (error) {
    if (error instanceof UserFacingError) return back(error.code === "limit_reached" ? "limite" : "interdit");
    throw error;
  }

  const response = NextResponse.redirect(oauth.authorizeUrl({ state, codeChallenge, redirectUri: oauthRedirectUri(env.APP_URL, provider) }), 303);
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    // « lax » : le cookie est renvoyé lors du retour du réseau (navigation de premier niveau).
    sameSite: "lax",
    path: OAUTH_COOKIE_PATH,
    maxAge: OAUTH_STATE_TTL_SECONDS,
  });
  return response;
}

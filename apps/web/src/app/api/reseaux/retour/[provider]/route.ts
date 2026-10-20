import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import { UserFacingError } from "@/server/services/errors";
import { receiveOAuthCallback } from "@/server/services/social-connections";
import { getSession } from "@/server/session";
import { getOAuthProvider, oauthRedirectUri } from "@/server/social";
import { OAUTH_COOKIE_PATH, OAUTH_STATE_COOKIE } from "@/server/social/cookies";
import { isOAuthProviderId, OAuthExchangeError } from "@/server/social/oauth";

export const maxDuration = 60;

/** Retour du réseau après l'autorisation : vérifie la demande, récupère les comptes, puis propose le choix. */
export async function GET(request: Request, context: RouteContext<"/api/reseaux/retour/[provider]">): Promise<Response> {
  const { provider } = await context.params;
  const env = getServerEnv();
  const url = new URL(request.url);
  const redirectTo = (path: string) => {
    const response = NextResponse.redirect(new URL(path, env.APP_URL), 303);
    response.cookies.set(OAUTH_STATE_COOKIE, "", { path: OAUTH_COOKIE_PATH, maxAge: 0 });
    return response;
  };
  const back = (code: string) => redirectTo(`/reseaux?connexion=${code}`);

  if (!isOAuthProviderId(provider)) return back("inconnu");
  const session = await getSession();
  if (!session?.user.emailVerified) return redirectTo("/connexion");
  // L'utilisateur a refusé ou annulé sur la page du réseau.
  if (url.searchParams.get("error")) return back("annulee");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = (await cookies()).get(OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !cookieState || cookieState !== state) return back("expiree");

  const oauth = getOAuthProvider(provider);
  const encryptionKey = env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (!oauth || !encryptionKey) return back("indisponible");

  try {
    await receiveOAuthCallback(getDb(), {
      stateId: state,
      userId: session.user.id,
      provider,
      encryptionKey,
      exchange: () => oauth.exchange({ code, redirectUri: oauthRedirectUri(env.APP_URL, provider), now: new Date() }),
    });
  } catch (error) {
    if (error instanceof OAuthExchangeError) {
      // Message du réseau, sans jeton ni secret.
      console.error("Connexion refusée par le réseau", provider, error.message);
      return back(error.message.startsWith("Aucune Page") ? "aucune-page" : "echec");
    }
    if (error instanceof UserFacingError) return back(error.code === "forbidden" ? "interdit" : "expiree");
    throw error;
  }
  return redirectTo(`/reseaux/choisir?demande=${encodeURIComponent(state)}`);
}

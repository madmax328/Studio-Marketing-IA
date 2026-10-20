import { PublishError, type PublishErrorKind } from "@/server/publishing/types";

/** `fetch` injectable (tests sans appel réseau). */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ApiResponse {
  status: number;
  headers: Headers;
  body: unknown;
}

/** Délai maximal d'un appel aux API des réseaux. */
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Appel HTTP vers une API de réseau. Une coupure réseau ou un délai dépassé lève `NetworkFailure` :
 * c'est à l'appelant de décider si la requête a pu aboutir quand même.
 */
export async function callApi(fetchImpl: FetchLike, url: string, init: RequestInit = {}): Promise<ApiResponse> {
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    throw new NetworkFailure(error);
  }
  const text = await response.text().catch(() => "");
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: response.status, headers: response.headers, body };
}

export class NetworkFailure extends Error {
  constructor(override readonly cause: unknown) {
    super("Le réseau social n'a pas répondu.");
    this.name = "NetworkFailure";
  }
}

/** Corps de formulaire (les API Meta et OAuth attendent du x-www-form-urlencoded). */
export function form(values: Record<string, string | number | boolean | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) params.set(key, String(value));
  }
  return params;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stringField(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  const field = value[key];
  if (typeof field === "string" && field.length > 0) return field;
  if (typeof field === "number") return String(field);
  return null;
}

export function numberField(value: unknown, key: string): number | null {
  if (!isRecord(value)) return null;
  const field = value[key];
  return typeof field === "number" && Number.isFinite(field) ? field : null;
}

/** Message court et sans données sensibles, extrait d'une réponse d'erreur (pour l'affichage). */
export function apiErrorMessage(body: unknown): string | null {
  const nested = isRecord(body) && isRecord(body.error) ? body.error : body;
  const message = stringField(nested, "error_user_msg") ?? stringField(nested, "message") ?? stringField(body, "error_description");
  return message ? message.slice(0, 300) : null;
}

export interface PublishStepOptions {
  /** La requête est celle qui publie : une erreur serveur y rend le résultat incertain. */
  finalStep: boolean;
  /** Statuts HTTP signifiant une autorisation refusée (401 par défaut). */
  authStatuses?: readonly number[];
  /** Codes d'erreur propres au réseau : autorisation refusée, ou erreur temporaire. */
  authCodes?: readonly number[];
  retryableCodes?: readonly number[];
}

/**
 * Transforme une réponse en échec de publication.
 */
export function publishFailure(
  networkLabel: string,
  response: ApiResponse,
  options: PublishStepOptions,
): PublishError {
  const error = isRecord(response.body) && isRecord(response.body.error) ? response.body.error : null;
  const code = numberField(error, "code");
  const transient = error?.is_transient === true;
  const detail = apiErrorMessage(response.body);
  const suffix = detail ? ` (${detail})` : "";

  let kind: PublishErrorKind;
  if ((options.authStatuses ?? [401]).includes(response.status) || (code !== null && options.authCodes?.includes(code))) kind = "auth";
  else if (response.status === 429 || transient || (code !== null && options.retryableCodes?.includes(code))) kind = "retryable";
  else if (response.status >= 500) kind = options.finalStep ? "uncertain" : "retryable";
  else kind = "permanent";

  const messages: Record<PublishErrorKind, string> = {
    auth: `${networkLabel} a refusé l'autorisation du compte${suffix}.`,
    retryable: `${networkLabel} est momentanément indisponible ou limite les envois${suffix}.`,
    uncertain: `${networkLabel} a rencontré une erreur au moment de publier : vérifiez sur le réseau si la publication est parue${suffix}.`,
    permanent: `${networkLabel} a refusé la publication${suffix}.`,
  };
  return new PublishError(messages[kind], kind);
}

/** Coupure réseau : sans réponse à la requête finale, on ne sait pas si la publication est partie. */
export function networkFailure(networkLabel: string, finalStep: boolean): PublishError {
  return finalStep
    ? new PublishError(`${networkLabel} n'a pas répondu au moment de publier : vérifiez sur le réseau si la publication est parue.`, "uncertain")
    : new PublishError(`${networkLabel} n'a pas répondu.`, "retryable");
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Exécute une étape d'envoi et lève une `PublishError` adaptée si elle échoue.
 * Les API Meta renvoient parfois `{ error }` avec un statut 200 : c'est aussi un échec.
 */
export async function publishStep(
  networkLabel: string,
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  options: PublishStepOptions,
): Promise<ApiResponse> {
  let response: ApiResponse;
  try {
    response = await callApi(fetchImpl, url, init);
  } catch (error) {
    if (error instanceof NetworkFailure) throw networkFailure(networkLabel, options.finalStep);
    throw error;
  }
  if (response.status >= 400 || (isRecord(response.body) && isRecord(response.body.error))) {
    throw publishFailure(networkLabel, response, options);
  }
  return response;
}

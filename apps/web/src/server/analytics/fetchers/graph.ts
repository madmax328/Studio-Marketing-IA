import { callApi, isRecord, NetworkFailure, numberField, type ApiResponse, type FetchLike } from "@/server/social/http";
import { MetricsError } from "../types";

/** Codes Graph API : autorisation absente ou insuffisante. */
const AUTH_CODES = [10, 102, 190, 200];
/** Codes Graph API : objet introuvable ou supprimé. */
const GONE_CODES = [100, 803];

export async function graphGet(fetchImpl: FetchLike, url: string, token: string): Promise<ApiResponse> {
  let response: ApiResponse;
  try {
    response = await callApi(fetchImpl, url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (error) {
    if (error instanceof NetworkFailure) throw new MetricsError("Le réseau n'a pas répondu.", "retryable");
    throw error;
  }
  const error = isRecord(response.body) && isRecord(response.body.error) ? response.body.error : null;
  if (response.status >= 400 || error) {
    const code = numberField(error, "code");
    if (response.status === 401 || (code !== null && AUTH_CODES.includes(code))) {
      throw new MetricsError("Les statistiques ne sont pas autorisées pour ce compte.", "unsupported");
    }
    if (response.status === 404 || (code !== null && GONE_CODES.includes(code) && numberField(error, "error_subcode") === 33)) {
      throw new MetricsError("La publication n'existe plus sur le réseau.", "gone");
    }
    if (code === 100) throw new MetricsError("Indicateur non disponible.", "unsupported");
    throw new MetricsError("Le réseau n'a pas fourni les statistiques.", "retryable");
  }
  return response;
}

/**
 * Lit une réponse « insights » de Meta : `{ data: [{ name, values: [{ value }] }] }`
 * ou `{ data: [{ name, total_value: { value } }] }`.
 */
export function readInsights(body: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  const data = isRecord(body) && Array.isArray(body.data) ? body.data : [];
  for (const item of data) {
    if (!isRecord(item) || typeof item.name !== "string") continue;
    const total = isRecord(item.total_value) ? item.total_value.value : undefined;
    const last = Array.isArray(item.values) ? item.values.at(-1) : undefined;
    const value = typeof total === "number" ? total : isRecord(last) ? last.value : undefined;
    if (typeof value === "number") result[item.name] = value;
  }
  return result;
}

/**
 * Demande plusieurs indicateurs ; si le réseau en refuse un (indicateur retiré, type de média),
 * on les redemande un par un pour garder ceux qui existent.
 */
export async function insightsTolerant(fetchImpl: FetchLike, base: string, token: string, metrics: readonly string[]): Promise<Record<string, number>> {
  try {
    return readInsights((await graphGet(fetchImpl, `${base}?metric=${metrics.join(",")}`, token)).body);
  } catch (error) {
    if (!(error instanceof MetricsError) || error.kind !== "unsupported" || metrics.length === 1) throw error;
  }
  const result: Record<string, number> = {};
  for (const metric of metrics) {
    try {
      Object.assign(result, readInsights((await graphGet(fetchImpl, `${base}?metric=${metric}`, token)).body));
    } catch (error) {
      if (!(error instanceof MetricsError) || error.kind !== "unsupported") throw error;
    }
  }
  return result;
}

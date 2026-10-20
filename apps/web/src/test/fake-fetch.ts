import type { FetchLike } from "@/server/social/http";

export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> } | Error;

/**
 * Faux `fetch` : chaque règle répond aux appels dont l'adresse contient `match` (et la méthode, si précisée).
 * Une règle avec plusieurs réponses les rend dans l'ordre (la dernière se répète).
 */
export function fakeFetch(rules: { match: string; method?: string; replies: Reply[] }[]) {
  const calls: RecordedCall[] = [];
  const counters = new Map<number, number>();
  const impl: FetchLike = async (input, init = {}) => {
    const method = (init.method ?? "GET").toUpperCase();
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const body = init.body instanceof URLSearchParams ? init.body.toString() : typeof init.body === "string" ? init.body : init.body ? "[binaire]" : null;
    calls.push({ url: input, method, headers, body });
    const index = rules.findIndex((rule) => input.includes(rule.match) && (!rule.method || rule.method === method));
    const rule = rules[index];
    if (!rule) throw new Error(`Appel inattendu : ${method} ${input}`);
    const count = counters.get(index) ?? 0;
    counters.set(index, count + 1);
    const reply = rule.replies[Math.min(count, rule.replies.length - 1)] as Reply;
    if (reply instanceof Error) throw reply;
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: reply.headers,
    });
  };
  return { impl, calls };
}

import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import type { PostDoc, SocialAccountDoc } from "@/server/db/collections";
import { fakeFetch } from "@/test/fake-fetch";
import { nextCollectionAt } from "../collector";
import { readInsights } from "../fetchers/graph";
import { createMetaMetrics } from "../fetchers/meta";
import { createThreadsMetrics } from "../fetchers/threads";
import type { MetricsContext } from "../types";

const context = (network: "facebook" | "instagram" | "threads", externalId: string): MetricsContext => ({
  post: { _id: new ObjectId(), network } as PostDoc,
  account: { network } as SocialAccountDoc,
  accessToken: "jeton",
  externalId,
});

describe("lecture des insights Meta", () => {
  it("accepte les deux formats de réponse", () => {
    expect(
      readInsights({ data: [{ name: "reach", values: [{ value: 120 }] }, { name: "views", total_value: { value: 300 } }, { name: "x" }] }),
    ).toEqual({ reach: 120, views: 300 });
  });
});

describe("statistiques Facebook", () => {
  it("réactions, commentaires, partages et insights, jeton dans l'en-tête", async () => {
    const fetch = fakeFetch([
      { match: "/insights", replies: [{ body: { data: [{ name: "post_impressions_unique", values: [{ value: 410 }] }, { name: "post_clicks", values: [{ value: 12 }] }] } }] },
      {
        match: "/P_1?fields=",
        replies: [{ body: { shares: { count: 3 }, reactions: { summary: { total_count: 25 } }, comments: { summary: { total_count: 4 } } } }],
      },
    ]);
    const metrics = await createMetaMetrics({ graphVersion: "v24.0", fetch: fetch.impl }).fetch(context("facebook", "P_1"));
    expect(metrics).toEqual({ likes: 25, comments: 4, shares: 3, reach: 410, clicks: 12 });
    expect(fetch.calls.every((call) => call.headers.authorization === "Bearer jeton" && !call.url.includes("jeton"))).toBe(true);
  });

  it("sans permission de statistiques avancées : garde les chiffres publics, partages absents = 0", async () => {
    const fetch = fakeFetch([
      { match: "/insights", replies: [{ status: 403, body: { error: { code: 10, message: "permission" } } }] },
      { match: "/P_2?fields=", replies: [{ body: { reactions: { summary: { total_count: 2 } }, comments: { summary: { total_count: 0 } } } }] },
    ]);
    const metrics = await createMetaMetrics({ graphVersion: "v24.0", fetch: fetch.impl }).fetch(context("facebook", "P_2"));
    expect(metrics).toEqual({ likes: 2, comments: 0, shares: 0 });
  });
});

describe("statistiques Instagram", () => {
  it("indicateur retiré par Meta : redemande un par un et garde les autres", async () => {
    const fetch = fakeFetch([
      { match: "metric=views,reach,shares,saved", replies: [{ status: 400, body: { error: { code: 100, message: "invalid metric" } } }] },
      { match: "metric=views", replies: [{ body: { data: [{ name: "views", values: [{ value: 900 }] }] } }] },
      { match: "metric=reach", replies: [{ body: { data: [{ name: "reach", values: [{ value: 640 }] }] } }] },
      { match: "metric=shares", replies: [{ status: 400, body: { error: { code: 100, message: "invalid metric" } } }] },
      { match: "metric=saved", replies: [{ body: { data: [{ name: "saved", values: [{ value: 7 }] }] } }] },
      { match: "?fields=like_count", replies: [{ body: { like_count: 51, comments_count: 6 } }] },
    ]);
    const metrics = await createMetaMetrics({ graphVersion: "v24.0", fetch: fetch.impl }).fetch(context("instagram", "IG_1"));
    expect(metrics).toEqual({ likes: 51, comments: 6, views: 900, reach: 640, saves: 7 });
  });

  it("publication supprimée : erreur « gone » ; réseau en panne : nouvel essai", async () => {
    const gone = fakeFetch([{ match: "?fields=like_count", replies: [{ status: 400, body: { error: { code: 100, error_subcode: 33, message: "does not exist" } } }] }]);
    await expect(createMetaMetrics({ graphVersion: "v24.0", fetch: gone.impl }).fetch(context("instagram", "X"))).rejects.toMatchObject({ kind: "gone" });
    const down = fakeFetch([{ match: "?fields=like_count", replies: [{ status: 503, body: "indisponible" }] }]);
    await expect(createMetaMetrics({ graphVersion: "v24.0", fetch: down.impl }).fetch(context("instagram", "X"))).rejects.toMatchObject({ kind: "retryable" });
  });
});

describe("statistiques Threads", () => {
  it("réponses comptées comme commentaires, republications et citations comme partages", async () => {
    const fetch = fakeFetch([
      {
        match: "/T_1/insights",
        replies: [
          {
            body: {
              data: ["views:300", "likes:20", "replies:5", "reposts:2", "quotes:1", "shares:3"].map((pair) => {
                const [name, value] = pair.split(":");
                return { name, values: [{ value: Number(value) }] };
              }),
            },
          },
        ],
      },
    ]);
    expect(await createThreadsMetrics({ fetch: fetch.impl }).fetch(context("threads", "T_1"))).toEqual({ views: 300, likes: 20, comments: 5, shares: 6 });
  });
});

describe("calendrier des relevés", () => {
  const published = new Date("2030-01-01T10:00:00Z");
  const after = (hours: number) => new Date(published.getTime() + hours * 3600_000);
  it("toutes les 3 h les deux premiers jours, puis 12 h, puis 2 jours, arrêt à 30 jours", () => {
    expect(nextCollectionAt(published, after(1))?.toISOString()).toBe(after(4).toISOString());
    expect(nextCollectionAt(published, after(72))?.toISOString()).toBe(after(84).toISOString());
    expect(nextCollectionAt(published, after(24 * 10))?.toISOString()).toBe(after(24 * 12).toISOString());
    expect(nextCollectionAt(published, after(24 * 29))?.toISOString()).toBe(after(24 * 30).toISOString());
    expect(nextCollectionAt(published, after(24 * 30))).toBeNull();
  });
});

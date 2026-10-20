import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import type { PostDoc, SocialAccountDoc } from "@/server/db/collections";
import { fakeFetch } from "@/test/fake-fetch";
import { createGoogleBusinessPublisher } from "../google-business";
import { createPinterestPublisher } from "../pinterest";
import { createTikTokPublisher, tiktokChunks } from "../tiktok";
import { createXPublisher } from "../x";
import { createYouTubePublisher, youtubeTitle } from "../youtube";
import type { PublishContext, PublishMedia } from "../../types";

const noSleep = async () => {};
const video = (size = 6): PublishMedia => ({ mediaId: "v", mimeType: "video/mp4", width: 1080, height: 1920, publicUrl: "https://app.test/m?s=1", read: async () => Buffer.alloc(size, 1) });
const image = (mimeType = "image/jpeg"): PublishMedia => ({ mediaId: "i", mimeType, width: 1080, height: 1080, publicUrl: "https://app.test/m?s=1", read: async () => Buffer.from([1, 2]) });

function context(network: SocialAccountDoc["network"], media: PublishMedia[], extra: Partial<PublishContext> = {}): PublishContext {
  return {
    post: { _id: new ObjectId(), network, text: "Nouvelle collection\nDécouvrez-la en boutique #mode" } as PostDoc,
    account: { network, externalAccountId: "ACC", displayName: "@atelier" } as SocialAccountDoc,
    accessToken: "jeton",
    resume: null,
    media,
    ...extra,
  };
}

describe("TikTok", () => {
  it("découpe les grosses vidéos en morceaux de 10 Mo, le dernier absorbant le reste", () => {
    expect(tiktokChunks(1000)).toEqual({ chunkSize: 1000, ranges: [{ first: 0, last: 999 }] });
    const mb = 1024 * 1024;
    const big = tiktokChunks(75 * mb);
    expect(big.chunkSize).toBe(10 * mb);
    expect(big.ranges).toHaveLength(7);
    expect(big.ranges.at(-1)).toEqual({ first: 60 * mb, last: 75 * mb - 1 });
  });

  it("vidéo : visibilité autorisée, envoi, suivi jusqu'à la parution", async () => {
    const fetch = fakeFetch([
      { match: "/creator_info/query/", replies: [{ body: { data: { privacy_level_options: ["SELF_ONLY", "PUBLIC_TO_EVERYONE"] }, error: { code: "ok" } } }] },
      { match: "/video/init/", replies: [{ body: { data: { publish_id: "P1", upload_url: "https://upload.tiktok.test/u" }, error: { code: "ok" } } }] },
      { match: "https://upload.tiktok.test/u", method: "PUT", replies: [{ status: 201 }] },
      {
        match: "/status/fetch/",
        replies: [
          { body: { data: { status: "PROCESSING_UPLOAD" }, error: { code: "ok" } } },
          { body: { data: { status: "PUBLISH_COMPLETE", publicaly_available_post_id: [7123] }, error: { code: "ok" } } },
        ],
      },
    ]);
    const result = await createTikTokPublisher({ fetch: fetch.impl, sleep: noSleep }).publish(context("tiktok", [video()]));
    expect(result).toEqual({ externalId: "7123", externalUrl: "https://www.tiktok.com/@atelier/video/7123", simulated: false });
    const init = JSON.parse(fetch.calls[1]?.body ?? "{}") as { post_info: { privacy_level: string }; source_info: unknown };
    expect(init.post_info.privacy_level).toBe("PUBLIC_TO_EVERYONE");
    expect(init.source_info).toEqual({ source: "FILE_UPLOAD", video_size: 6, chunk_size: 6, total_chunk_count: 1 });
    expect(fetch.calls[2]?.headers["content-range"]).toBe("bytes 0-5/6");
  });

  it("application non validée : explication claire ; traitement long : reprise sans renvoyer", async () => {
    const unaudited = fakeFetch([
      { match: "/creator_info/query/", replies: [{ body: { data: { privacy_level_options: ["SELF_ONLY"] }, error: { code: "ok" } } }] },
      { match: "/video/init/", replies: [{ body: { error: { code: "unaudited_client_can_only_post_to_private_accounts", message: "x" } } }] },
    ]);
    await expect(createTikTokPublisher({ fetch: unaudited.impl }).publish(context("tiktok", [video()]))).rejects.toMatchObject({ kind: "permanent", message: expect.stringContaining("validée par TikTok") });

    const slow = fakeFetch([{ match: "/status/fetch/", replies: [{ body: { data: { status: "PROCESSING_DOWNLOAD" }, error: { code: "ok" } } }] }]);
    await expect(
      createTikTokPublisher({ fetch: slow.impl, sleep: noSleep }).publish(context("tiktok", [video()], { resume: { tiktokPublishId: "P1" } })),
    ).rejects.toMatchObject({ kind: "retryable", resume: { tiktokPublishId: "P1" } });
    expect(slow.calls.every((call) => call.url.includes("/status/fetch/"))).toBe(true);
  });

  it("photos : récupérées par TikTok via les liens signés, convertis en JPEG si besoin", async () => {
    const fetch = fakeFetch([
      { match: "/creator_info/query/", replies: [{ body: { data: { privacy_level_options: ["PUBLIC_TO_EVERYONE"] }, error: { code: "ok" } } }] },
      { match: "/content/init/", replies: [{ body: { data: { publish_id: "P2" }, error: { code: "ok" } } }] },
      { match: "/status/fetch/", replies: [{ body: { data: { status: "PUBLISH_COMPLETE", publicaly_available_post_id: [] }, error: { code: "ok" } } }] },
    ]);
    const result = await createTikTokPublisher({ fetch: fetch.impl, sleep: noSleep }).publish(context("tiktok", [image(), image("image/png")]));
    expect(result.externalId).toBe("P2");
    const body = JSON.parse(fetch.calls[1]?.body ?? "{}") as { source_info: { photo_images: string[] }; media_type: string };
    expect(body.media_type).toBe("PHOTO");
    expect(body.source_info.photo_images).toEqual(["https://app.test/m?s=1", "https://app.test/m?s=1&format=jpeg"]);
  });
});

describe("YouTube", () => {
  it("titre : première ligne, sans mots-dièse ni chevrons, 100 caractères au plus", () => {
    expect(youtubeTitle("Soldes <ici> #promo\nsuite")).toBe("Soldes ici");
    expect(youtubeTitle("#tag")).toBe("Vidéo");
    expect(youtubeTitle("a".repeat(150))).toHaveLength(100);
  });

  it("envoi « resumable » : session puis fichier, lien de la vidéo", async () => {
    const fetch = fakeFetch([
      { match: "uploadType=resumable", method: "POST", replies: [{ status: 200, headers: { location: "https://upload.youtube.test/s1" } }] },
      { match: "https://upload.youtube.test/s1", method: "PUT", replies: [{ status: 201, body: { id: "VID" } }] },
    ]);
    const result = await createYouTubePublisher({ fetch: fetch.impl }).publish(context("youtube", [video()]));
    expect(result).toEqual({ externalId: "VID", externalUrl: "https://www.youtube.com/watch?v=VID", simulated: false });
    expect(fetch.calls[0]?.headers["x-upload-content-length"]).toBe("6");
    const meta = JSON.parse(fetch.calls[0]?.body ?? "{}") as { snippet: { title: string }; status: { privacyStatus: string } };
    expect(meta.snippet.title).toBe("Nouvelle collection");
    expect(meta.status.privacyStatus).toBe("public");
  });

  it("quota épuisé → nouvel essai plus tard ; image → refus", async () => {
    const quota = fakeFetch([{ match: "uploadType=resumable", replies: [{ status: 403, body: { error: { code: 403, message: "quota", errors: [{ reason: "quotaExceeded" }] } } }] }]);
    await expect(createYouTubePublisher({ fetch: quota.impl }).publish(context("youtube", [video()]))).rejects.toMatchObject({ kind: "retryable" });
    await expect(createYouTubePublisher({ fetch: quota.impl }).publish(context("youtube", [image()]))).rejects.toMatchObject({ kind: "permanent" });
  });
});

describe("Pinterest", () => {
  it("épingle avec plusieurs images dans le tableau choisi", async () => {
    const fetch = fakeFetch([{ match: "/v5/pins", replies: [{ status: 201, body: { id: "PIN1" } }] }]);
    const result = await createPinterestPublisher({ fetch: fetch.impl }).publish(context("pinterest", [image(), image("image/webp")]));
    expect(result.externalUrl).toBe("https://www.pinterest.com/pin/PIN1/");
    const body = JSON.parse(fetch.calls[0]?.body ?? "{}") as Record<string, unknown>;
    expect(body).toMatchObject({ board_id: "ACC", title: "Nouvelle collection", media_source: { source_type: "multiple_image_urls" } });
  });

  it("vidéo : enregistrement, dépôt, attente du traitement puis épingle", async () => {
    const fetch = fakeFetch([
      { match: "/v5/media/M1", replies: [{ body: { status: "processing" } }, { body: { status: "succeeded" } }] },
      { match: "/v5/media", method: "POST", replies: [{ status: 201, body: { media_id: "M1", upload_url: "https://s3.test/up", upload_parameters: { key: "k" } } }] },
      { match: "https://s3.test/up", replies: [{ status: 204 }] },
      { match: "/v5/pins", replies: [{ status: 201, body: { id: "PIN2" } }] },
    ]);
    await createPinterestPublisher({ fetch: fetch.impl, sleep: noSleep }).publish(context("pinterest", [video()]));
    const pin = JSON.parse(fetch.calls.at(-1)?.body ?? "{}") as { media_source: unknown };
    expect(pin.media_source).toEqual({ source_type: "video_id", media_id: "M1", cover_image_key_frame_time: 1 });
  });
});

describe("X", () => {
  it("texte seul", async () => {
    const fetch = fakeFetch([{ match: "/2/tweets", replies: [{ status: 201, body: { data: { id: "T1" } } }] }]);
    const result = await createXPublisher({ fetch: fetch.impl }).publish(context("x", []));
    expect(result.externalUrl).toBe("https://x.com/atelier/status/T1");
    expect(JSON.parse(fetch.calls[0]?.body ?? "{}")).toEqual({ text: "Nouvelle collection\nDécouvrez-la en boutique #mode" });
  });

  it("images envoyées par morceaux puis jointes à la publication", async () => {
    const fetch = fakeFetch([
      { match: "/media/upload/initialize", replies: [{ body: { data: { id: "MED1" } } }, { body: { data: { id: "MED2" } } }] },
      { match: "/append", replies: [{ status: 204 }] },
      { match: "/finalize", replies: [{ body: { data: { id: "x" } } }] },
      { match: "/2/tweets", replies: [{ status: 201, body: { data: { id: "T2" } } }] },
    ]);
    await createXPublisher({ fetch: fetch.impl }).publish(context("x", [image(), image()]));
    const tweet = JSON.parse(fetch.calls.at(-1)?.body ?? "{}") as { media: unknown };
    expect(tweet.media).toEqual({ media_ids: ["MED1", "MED2"] });
  });

  it("vidéo en traitement : reprise au passage suivant ; accès refusé → compte à reconnecter", async () => {
    const slow = fakeFetch([{ match: "command=STATUS", replies: [{ body: { data: { processing_info: { state: "in_progress", check_after_secs: 1 } } } }] }]);
    await expect(createXPublisher({ fetch: slow.impl, sleep: noSleep }).publish(context("x", [video()], { resume: { xMedia: "MED9" } }))).rejects.toMatchObject({
      kind: "retryable",
      resume: { xMedia: "MED9" },
    });
    const denied = fakeFetch([{ match: "/2/tweets", replies: [{ status: 401, body: { title: "Unauthorized", detail: "Unauthorized" } }] }]);
    await expect(createXPublisher({ fetch: denied.impl }).publish(context("x", []))).rejects.toMatchObject({ kind: "auth" });
  });
});

describe("Google Business Profile", () => {
  it("publie une nouveauté avec photo sur l'établissement", async () => {
    const fetch = fakeFetch([{ match: "/v4/accounts/1/locations/9/localPosts", replies: [{ body: { name: "accounts/1/locations/9/localPosts/5", searchUrl: "https://local.google.com/p/5" } }] }]);
    const ctx = context("google_business", [image()]);
    ctx.account = { ...ctx.account, externalAccountId: "accounts/1/locations/9" };
    const result = await createGoogleBusinessPublisher({ fetch: fetch.impl }).publish(ctx);
    expect(result.externalUrl).toBe("https://local.google.com/p/5");
    const body = JSON.parse(fetch.calls[0]?.body ?? "{}") as Record<string, unknown>;
    expect(body).toMatchObject({ languageCode: "fr", topicType: "STANDARD", media: [{ mediaFormat: "PHOTO", sourceUrl: "https://app.test/m?s=1" }] });
  });
});

describe("statistiques des nouveaux réseaux", () => {
  const ctx = (externalId: string) => ({ post: {} as PostDoc, account: {} as SocialAccountDoc, accessToken: "jeton", externalId });

  it("YouTube (chiffres en texte), TikTok, Pinterest et X", async () => {
    const { createPinterestMetrics, createTikTokMetrics, createXMetrics, createYouTubeMetrics } = await import("@/server/analytics/fetchers/networks-v2");
    const yt = fakeFetch([{ match: "/youtube/v3/videos", replies: [{ body: { items: [{ statistics: { viewCount: "120", likeCount: "8", commentCount: "2" } }] } }] }]);
    expect(await createYouTubeMetrics({ fetch: yt.impl }).fetch(ctx("VID"))).toEqual({ views: 120, likes: 8, comments: 2 });

    const tt = fakeFetch([{ match: "/video/query/", replies: [{ body: { data: { videos: [{ view_count: 900, like_count: 50, comment_count: 4, share_count: 3 }] }, error: { code: "ok" } } }] }]);
    expect(await createTikTokMetrics({ fetch: tt.impl }).fetch(ctx("7123"))).toEqual({ views: 900, likes: 50, comments: 4, shares: 3 });
    await expect(createTikTokMetrics({ fetch: tt.impl }).fetch(ctx("v_pub_1"))).rejects.toMatchObject({ kind: "unsupported" });

    const pin = fakeFetch([{ match: "/pins/P1", replies: [{ body: { pin_metrics: { lifetime_metrics: { impression: 300, save: 12, pin_click: 5, outbound_click: 2 } } } }] }]);
    expect(await createPinterestMetrics({ fetch: pin.impl }).fetch(ctx("P1"))).toEqual({ views: 300, saves: 12, clicks: 7 });

    const x = fakeFetch([{ match: "/2/tweets/T1", replies: [{ body: { data: { public_metrics: { impression_count: 500, like_count: 9, reply_count: 1, retweet_count: 2, quote_count: 1, bookmark_count: 3 } } } }] }]);
    expect(await createXMetrics({ fetch: x.impl }).fetch(ctx("T1"))).toEqual({ views: 500, likes: 9, comments: 1, shares: 3, saves: 3 });

    const gone = fakeFetch([{ match: "/2/tweets/T2", replies: [{ status: 404 }] }]);
    await expect(createXMetrics({ fetch: gone.impl }).fetch(ctx("T2"))).rejects.toMatchObject({ kind: "gone" });
  });
});

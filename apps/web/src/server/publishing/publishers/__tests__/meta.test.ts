import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import type { PostDoc, SocialAccountDoc } from "@/server/db/collections";
import { fakeFetch } from "@/test/fake-fetch";
import { createMetaPublisher, instagramMediaProblem } from "../meta";
import type { PublishContext, PublishMedia } from "../../types";

const noSleep = async () => {};

function context(network: "facebook" | "instagram", media: Partial<PublishMedia>[] = [], resume: Record<string, string> | null = null): PublishContext {
  return {
    post: { _id: new ObjectId(), network, text: "Bonjour #promo" } as PostDoc,
    account: { network, externalAccountId: network === "facebook" ? "PAGE1" : "IG1", displayName: "Ma page" } as SocialAccountDoc,
    accessToken: "jeton-page",
    resume,
    media: media.map((item, index) => ({
      mediaId: `m${index}`,
      mimeType: "image/jpeg",
      width: 1080,
      height: 1080,
      publicUrl: `https://app.test/api/medias/public/m${index}?exp=1&sig=s`,
      read: async () => Buffer.from("x"),
      ...item,
    })),
  };
}

describe("connecteur Meta — Facebook", () => {
  it("publie un texte seul sur la Page, jeton dans l'en-tête et jamais dans l'adresse", async () => {
    const fetch = fakeFetch([{ match: "/PAGE1/feed", method: "POST", replies: [{ body: { id: "PAGE1_99" } }] }]);
    const result = await createMetaPublisher({ graphVersion: "v24.0", fetch: fetch.impl }).publish(context("facebook"));
    expect(result).toEqual({ externalId: "PAGE1_99", externalUrl: "https://www.facebook.com/PAGE1_99", simulated: false });
    expect(fetch.calls[0]?.url).toBe("https://graph.facebook.com/v24.0/PAGE1/feed");
    expect(fetch.calls[0]?.headers.authorization).toBe("Bearer jeton-page");
    expect(fetch.calls[0]?.body).toContain("message=Bonjour");
  });

  it("publie une image avec sa légende", async () => {
    const fetch = fakeFetch([{ match: "/PAGE1/photos", replies: [{ body: { id: "PHOTO", post_id: "PAGE1_7" } }] }]);
    const result = await createMetaPublisher({ graphVersion: "v24.0", fetch: fetch.impl }).publish(context("facebook", [{}]));
    expect(result.externalId).toBe("PAGE1_7");
    expect(fetch.calls[0]?.body).toContain("caption=Bonjour");
  });

  it("regroupe plusieurs images : photos non publiées puis une seule publication", async () => {
    const fetch = fakeFetch([
      { match: "/PAGE1/photos", replies: [{ body: { id: "P1" } }, { body: { id: "P2" } }] },
      { match: "/PAGE1/feed", replies: [{ body: { id: "PAGE1_8" } }] },
    ]);
    await createMetaPublisher({ graphVersion: "v24.0", fetch: fetch.impl }).publish(context("facebook", [{}, {}]));
    expect(fetch.calls.map((call) => call.url.split("/").pop())).toEqual(["photos", "photos", "feed"]);
    expect(fetch.calls[0]?.body).toContain("published=false");
    const feed = new URLSearchParams(fetch.calls[2]?.body ?? "");
    expect(feed.get("attached_media[0]")).toBe('{"media_fbid":"P1"}');
    expect(feed.get("attached_media[1]")).toBe('{"media_fbid":"P2"}');
  });

  it("jeton refusé (code 190) → compte à reconnecter", async () => {
    const fetch = fakeFetch([{ match: "/feed", replies: [{ status: 400, body: { error: { code: 190, message: "Invalid OAuth access token" } } }] }]);
    await expect(createMetaPublisher({ graphVersion: "v24.0", fetch: fetch.impl }).publish(context("facebook"))).rejects.toMatchObject({ kind: "auth" });
  });

  it("limite de débit → nouvel essai ; erreur serveur à l'étape finale → résultat incertain", async () => {
    const limited = fakeFetch([{ match: "/feed", replies: [{ status: 400, body: { error: { code: 32, message: "rate" } } }] }]);
    await expect(createMetaPublisher({ graphVersion: "v24.0", fetch: limited.impl }).publish(context("facebook"))).rejects.toMatchObject({ kind: "retryable" });
    const broken = fakeFetch([{ match: "/feed", replies: [{ status: 500, body: { error: { code: 2, is_transient: false, message: "x" } } }] }]);
    // code 2 = service temporairement indisponible : refusé avant publication.
    await expect(createMetaPublisher({ graphVersion: "v24.0", fetch: broken.impl }).publish(context("facebook"))).rejects.toMatchObject({ kind: "retryable" });
    const unknown = fakeFetch([{ match: "/feed", replies: [{ status: 502, body: "Bad gateway" }] }]);
    await expect(createMetaPublisher({ graphVersion: "v24.0", fetch: unknown.impl }).publish(context("facebook"))).rejects.toMatchObject({ kind: "uncertain" });
    const cut = fakeFetch([{ match: "/feed", replies: [new TypeError("fetch failed")] }]);
    await expect(createMetaPublisher({ graphVersion: "v24.0", fetch: cut.impl }).publish(context("facebook"))).rejects.toMatchObject({ kind: "uncertain" });
  });
});

describe("connecteur Meta — Instagram", () => {
  it("crée un carrousel, attend le traitement, publie puis récupère le lien", async () => {
    const fetch = fakeFetch([
      { match: "/IG1/media_publish", method: "POST", replies: [{ body: { id: "IGMEDIA" } }] },
      { match: "/IG1/media", method: "POST", replies: [{ body: { id: "C1" } }, { body: { id: "C2" } }, { body: { id: "CAR" } }] },
      { match: "fields=status_code", replies: [{ body: { status_code: "IN_PROGRESS" } }, { body: { status_code: "FINISHED" } }] },
      { match: "IGMEDIA?fields=permalink", replies: [{ body: { permalink: "https://www.instagram.com/p/abc/" } }] },
    ]);
    const result = await createMetaPublisher({ graphVersion: "v24.0", fetch: fetch.impl, sleep: noSleep }).publish(
      context("instagram", [{ mimeType: "image/png" }, {}]),
    );
    expect(result).toEqual({ externalId: "IGMEDIA", externalUrl: "https://www.instagram.com/p/abc/", simulated: false });
    const creations = fetch.calls.filter((call) => call.url.endsWith("/IG1/media")).map((call) => new URLSearchParams(call.body ?? ""));
    // PNG converti en JPEG par le lien signé ; JPEG transmis tel quel.
    expect(creations[0]?.get("image_url")).toMatch(/&format=jpeg$/);
    expect(creations[1]?.get("image_url")).not.toMatch(/format=jpeg/);
    expect(creations[0]?.get("is_carousel_item")).toBe("true");
    expect(creations[2]?.get("media_type")).toBe("CAROUSEL");
    expect(creations[2]?.get("children")).toBe("C1,C2");
    expect(creations[2]?.get("caption")).toBe("Bonjour #promo");
  });

  it("refuse avant tout appel une image hors format (story 9:16)", async () => {
    const fetch = fakeFetch([]);
    await expect(
      createMetaPublisher({ graphVersion: "v24.0", fetch: fetch.impl }).publish(context("instagram", [{ width: 1080, height: 1920 }])),
    ).rejects.toMatchObject({ kind: "permanent" });
    expect(fetch.calls).toHaveLength(0);
  });

  it("traitement trop long → nouvel essai plus tard, sans rien publier", async () => {
    const fetch = fakeFetch([
      { match: "/IG1/media", method: "POST", replies: [{ body: { id: "C1" } }] },
      { match: "fields=status_code", replies: [{ body: { status_code: "IN_PROGRESS" } }] },
    ]);
    await expect(
      createMetaPublisher({ graphVersion: "v24.0", fetch: fetch.impl, sleep: noSleep }).publish(context("instagram", [{}])),
    ).rejects.toMatchObject({ kind: "retryable" });
    expect(fetch.calls.some((call) => call.url.includes("media_publish"))).toBe(false);
  });

  it("formats acceptés : carré, portrait 4:5, paysage 1,91:1", () => {
    expect(instagramMediaProblem([{ width: 1080, height: 1080 }])).toBeNull();
    expect(instagramMediaProblem([{ width: 1080, height: 1350 }])).toBeNull();
    expect(instagramMediaProblem([{ width: 1200, height: 628 }])).toBeNull();
    expect(instagramMediaProblem([])).not.toBeNull();
    expect(instagramMediaProblem(Array.from({ length: 11 }, () => ({ width: 1, height: 1 })))).not.toBeNull();
  });
});

describe("connecteur Meta — vidéos", () => {
  const video = { mimeType: "video/mp4", width: 1080, height: 1920, publicUrl: "https://app.test/api/medias/public/v?exp=1&sig=s" };

  it("Facebook : vidéo envoyée par lien, avec sa description", async () => {
    const fetch = fakeFetch([{ match: "/PAGE1/videos", replies: [{ body: { id: "V1" } }] }]);
    const result = await createMetaPublisher({ graphVersion: "v24.0", fetch: fetch.impl }).publish(context("facebook", [video]));
    expect(result).toEqual({ externalId: "V1", externalUrl: "https://www.facebook.com/PAGE1/videos/V1", simulated: false });
    const body = new URLSearchParams(fetch.calls[0]?.body ?? "");
    expect(body.get("file_url")).toBe(video.publicUrl);
    expect(body.get("description")).toBe("Bonjour #promo");
  });

  it("Instagram : Reel encore en traitement → nouvel essai qui reprend le même conteneur, sans le recréer", async () => {
    const first = fakeFetch([
      { match: "/IG1/media", method: "POST", replies: [{ body: { id: "REEL1" } }] },
      { match: "REEL1?fields=status_code", replies: [{ body: { status_code: "IN_PROGRESS" } }] },
    ]);
    const error = await createMetaPublisher({ graphVersion: "v24.0", fetch: first.impl, sleep: noSleep })
      .publish(context("instagram", [video]))
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ kind: "retryable", resume: { instagramContainer: "REEL1" } });
    const created = new URLSearchParams(first.calls[0]?.body ?? "");
    expect(created.get("media_type")).toBe("REELS");
    expect(created.get("video_url")).toBe(video.publicUrl);
    expect(first.calls.some((call) => call.url.includes("media_publish"))).toBe(false);

    const second = fakeFetch([
      { match: "/IG1/media_publish", replies: [{ body: { id: "IGV" } }] },
      { match: "REEL1?fields=status_code", replies: [{ body: { status_code: "FINISHED" } }] },
      { match: "IGV?fields=permalink", replies: [{ body: { permalink: "https://www.instagram.com/reel/x/" } }] },
    ]);
    const result = await createMetaPublisher({ graphVersion: "v24.0", fetch: second.impl, sleep: noSleep }).publish(
      context("instagram", [video], { instagramContainer: "REEL1" }),
    );
    expect(result.externalId).toBe("IGV");
    // Aucun nouveau conteneur créé lors de la reprise.
    expect(second.calls.some((call) => call.url.endsWith("/IG1/media"))).toBe(false);
  });
});

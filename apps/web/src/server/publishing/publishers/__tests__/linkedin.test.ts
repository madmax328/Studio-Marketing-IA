import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import type { PostDoc, SocialAccountDoc } from "@/server/db/collections";
import { fakeFetch } from "@/test/fake-fetch";
import { createLinkedInPublisher, toLinkedInCommentary } from "../linkedin";
import type { PublishContext } from "../../types";

function context(images: number): PublishContext {
  return {
    post: { _id: new ObjectId(), network: "linkedin", text: "Nouveau (enfin) !" } as PostDoc,
    account: { network: "linkedin", externalAccountId: "urn:li:person:abc", displayName: "Alice" } as SocialAccountDoc,
    accessToken: "jeton",
    resume: null,
    media: Array.from({ length: images }, (_, index) => ({
      mediaId: `m${index}`,
      mimeType: "image/jpeg",
      width: 1200,
      height: 1200,
      publicUrl: "https://app.test/x",
      read: async () => Buffer.from([1, 2, 3]),
    })),
  };
}

describe("connecteur LinkedIn", () => {
  it("publie un texte : en-têtes de version, texte échappé, lien de la publication", async () => {
    const fetch = fakeFetch([{ match: "/rest/posts", method: "POST", replies: [{ status: 201, headers: { "x-restli-id": "urn:li:share:42" } }] }]);
    const result = await createLinkedInPublisher({ apiVersion: "202609", fetch: fetch.impl }).publish(context(0));
    expect(result).toEqual({ externalId: "urn:li:share:42", externalUrl: "https://www.linkedin.com/feed/update/urn:li:share:42/", simulated: false });
    const call = fetch.calls[0];
    expect(call?.headers["linkedin-version"]).toBe("202609");
    expect(call?.headers["x-restli-protocol-version"]).toBe("2.0.0");
    const body = JSON.parse(call?.body ?? "{}") as Record<string, unknown>;
    expect(body.author).toBe("urn:li:person:abc");
    expect(body.commentary).toBe("Nouveau \\(enfin\\) !");
    expect(body.content).toBeUndefined();
  });

  it("envoie les images puis publie un multi-images", async () => {
    const fetch = fakeFetch([
      {
        match: "initializeUpload",
        replies: [
          { body: { value: { uploadUrl: "https://upload.test/1", image: "urn:li:image:1" } } },
          { body: { value: { uploadUrl: "https://upload.test/2", image: "urn:li:image:2" } } },
        ],
      },
      { match: "https://upload.test/", method: "PUT", replies: [{ status: 201 }] },
      { match: "/rest/posts", replies: [{ status: 201, headers: { "x-restli-id": "urn:li:share:1" } }] },
    ]);
    await createLinkedInPublisher({ apiVersion: "202609", fetch: fetch.impl }).publish(context(2));
    expect(fetch.calls.map((call) => call.method)).toEqual(["POST", "PUT", "POST", "PUT", "POST"]);
    const body = JSON.parse(fetch.calls[4]?.body ?? "{}") as { content: unknown };
    expect(body.content).toEqual({ multiImage: { images: [{ id: "urn:li:image:1" }, { id: "urn:li:image:2" }] } });
  });

  it("envoie une vidéo en plusieurs parties, attend son traitement puis la publie", async () => {
    const bytes = Buffer.from([1, 2, 3, 4, 5, 6]);
    const ctx = { ...context(0), media: [{ mediaId: "v", mimeType: "video/mp4", width: 1080, height: 1920, publicUrl: "https://app.test/v", read: async () => bytes }] };
    const fetch = fakeFetch([
      {
        match: "videos?action=initializeUpload",
        replies: [
          {
            body: {
              value: {
                video: "urn:li:video:9",
                uploadToken: "tok",
                uploadInstructions: [
                  { uploadUrl: "https://upload.test/p1", firstByte: 0, lastByte: 3 },
                  { uploadUrl: "https://upload.test/p2", firstByte: 4, lastByte: 5 },
                ],
              },
            },
          },
        ],
      },
      { match: "https://upload.test/p1", method: "PUT", replies: [{ status: 200, headers: { etag: "e1" } }] },
      { match: "https://upload.test/p2", method: "PUT", replies: [{ status: 200, headers: { etag: "e2" } }] },
      { match: "videos?action=finalizeUpload", replies: [{ status: 200 }] },
      { match: "/rest/videos/urn", replies: [{ body: { status: "PROCESSING" } }, { body: { status: "AVAILABLE" } }] },
      { match: "/rest/posts", replies: [{ status: 201, headers: { "x-restli-id": "urn:li:share:7" } }] },
    ]);
    const publisher = createLinkedInPublisher({ apiVersion: "202609", fetch: fetch.impl, sleep: async () => {} });
    expect((await publisher.publish(ctx)).externalId).toBe("urn:li:share:7");
    const init = JSON.parse(fetch.calls[0]?.body ?? "{}") as { initializeUploadRequest: { fileSizeBytes: number } };
    expect(init.initializeUploadRequest.fileSizeBytes).toBe(6);
    const finalize = JSON.parse(fetch.calls[3]?.body ?? "{}") as { finalizeUploadRequest: unknown };
    expect(finalize.finalizeUploadRequest).toEqual({ video: "urn:li:video:9", uploadToken: "tok", uploadedPartIds: ["e1", "e2"] });
    const post = JSON.parse(fetch.calls.at(-1)?.body ?? "{}") as { content: unknown };
    expect(post.content).toEqual({ media: { id: "urn:li:video:9" } });
  });

  it("vidéo encore en traitement : reprise au passage suivant sans renvoyer le fichier", async () => {
    const ctx = { ...context(0), media: [{ mediaId: "v", mimeType: "video/mp4", width: 1080, height: 1920, publicUrl: "https://app.test/v", read: async () => Buffer.from([1]) }] };
    const slow = fakeFetch([{ match: "/rest/videos/urn", replies: Array.from({ length: 6 }, () => ({ body: { status: "PROCESSING" } })) }]);
    await expect(
      createLinkedInPublisher({ apiVersion: "202609", fetch: slow.impl, sleep: async () => {} }).publish({ ...ctx, resume: { linkedinVideo: "urn:li:video:9" } }),
    ).rejects.toMatchObject({ kind: "retryable", resume: { linkedinVideo: "urn:li:video:9" } });
    expect(slow.calls.some((call) => call.url.includes("initializeUpload"))).toBe(false);
  });

  it("permission refusée (403) → compte à reconnecter ; contenu refusé (422) → échec définitif", async () => {
    const denied = fakeFetch([{ match: "/rest/posts", replies: [{ status: 403, body: { message: "ACCESS_DENIED" } }] }]);
    await expect(createLinkedInPublisher({ apiVersion: "202609", fetch: denied.impl }).publish(context(0))).rejects.toMatchObject({ kind: "auth" });
    const duplicate = fakeFetch([{ match: "/rest/posts", replies: [{ status: 422, body: { message: "Content is a duplicate" } }] }]);
    await expect(createLinkedInPublisher({ apiVersion: "202609", fetch: duplicate.impl }).publish(context(0))).rejects.toMatchObject({
      kind: "permanent",
      message: expect.stringContaining("Content is a duplicate"),
    });
  });
});

describe("texte LinkedIn (little text)", () => {
  it("échappe les caractères réservés et garde les mots-dièse cliquables", () => {
    expect(toLinkedInCommentary("Soldes -20% (jusqu'à dimanche) #Promo #été_2026")).toBe(
      "Soldes -20% \\(jusqu'à dimanche\\) {hashtag|\\#|Promo} {hashtag|\\#|été\\_2026}",
    );
    expect(toLinkedInCommentary("Contact : a_b@c.fr [ici] <3 *gras* ~x~ a|b {c} \\")).toBe(
      "Contact : a\\_b\\@c.fr \\[ici\\] \\<3 \\*gras\\* \\~x\\~ a\\|b \\{c\\} \\\\",
    );
    // « n°#1 » ou « C#» ne sont pas des mots-dièse.
    expect(toLinkedInCommentary("Top #1 du C#dev")).toBe("Top \\#1 du C\\#dev");
  });
});

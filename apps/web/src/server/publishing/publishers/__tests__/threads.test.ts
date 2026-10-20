import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import type { PostDoc, SocialAccountDoc } from "@/server/db/collections";
import { fakeFetch } from "@/test/fake-fetch";
import { createThreadsPublisher } from "../threads";
import type { PublishContext } from "../../types";

const ctx = (mimeTypes: string[]): PublishContext => ({
  post: { _id: new ObjectId(), network: "threads", text: "Salut" } as PostDoc,
  account: { network: "threads", externalAccountId: "TH1", displayName: "@moi" } as SocialAccountDoc,
  accessToken: "jeton",
  media: mimeTypes.map((mimeType, index) => ({
    mediaId: `m${index}`,
    mimeType,
    width: 1000,
    height: 1000,
    publicUrl: `https://app.test/m${index}?exp=1&sig=s`,
    read: async () => Buffer.from("x"),
  })),
});

describe("connecteur Threads", () => {
  it("publie un texte : conteneur, attente, publication, lien", async () => {
    const fetch = fakeFetch([
      { match: "/TH1/threads_publish", replies: [{ body: { id: "T99" } }] },
      { match: "/TH1/threads", replies: [{ body: { id: "C1" } }] },
      { match: "C1?fields=status", replies: [{ body: { status: "FINISHED" } }] },
      { match: "T99?fields=permalink", replies: [{ body: { permalink: "https://www.threads.net/@moi/post/x" } }] },
    ]);
    const result = await createThreadsPublisher({ fetch: fetch.impl, sleep: async () => {} }).publish(ctx([]));
    expect(result).toEqual({ externalId: "T99", externalUrl: "https://www.threads.net/@moi/post/x", simulated: false });
    expect(new URLSearchParams(fetch.calls[0]?.body ?? "").get("media_type")).toBe("TEXT");
  });

  it("carrousel : WebP converti en JPEG, PNG transmis tel quel", async () => {
    const fetch = fakeFetch([
      { match: "/TH1/threads_publish", replies: [{ body: { id: "T1" } }] },
      { match: "/TH1/threads", replies: [{ body: { id: "A" } }, { body: { id: "B" } }, { body: { id: "CAR" } }] },
      { match: "?fields=status", replies: [{ body: { status: "FINISHED" } }] },
      { match: "?fields=permalink", replies: [{ status: 500 }] },
    ]);
    const result = await createThreadsPublisher({ fetch: fetch.impl, sleep: async () => {} }).publish(ctx(["image/webp", "image/png"]));
    // Lien indisponible : la publication reste réussie.
    expect(result.externalUrl).toBeNull();
    const created = fetch.calls.filter((call) => call.url.endsWith("/TH1/threads")).map((call) => new URLSearchParams(call.body ?? ""));
    expect(created[0]?.get("image_url")).toMatch(/format=jpeg$/);
    expect(created[1]?.get("image_url")).not.toMatch(/format=jpeg/);
    expect(created[2]?.get("children")).toBe("A,B");
  });

  it("préparation en erreur → échec définitif avec la raison", async () => {
    const fetch = fakeFetch([
      { match: "/TH1/threads", replies: [{ body: { id: "C1" } }] },
      { match: "fields=status", replies: [{ body: { status: "ERROR", error_message: "FAILED_DOWNLOADING_VIDEO" } }] },
    ]);
    await expect(createThreadsPublisher({ fetch: fetch.impl, sleep: async () => {} }).publish(ctx([]))).rejects.toMatchObject({
      kind: "permanent",
      message: expect.stringContaining("FAILED_DOWNLOADING_VIDEO"),
    });
  });
});

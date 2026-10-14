import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EDITABLE_POST_STATUSES, POST_STATUS_LABELS, roleHasPermission, SOCIAL_NETWORKS, toZoned } from "@smia/shared";
import { getTextProvider } from "@/server/ai";
import { hasAiConsent } from "@/server/services/generation";
import { PostEditor } from "@/components/posts/post-editor";
import { PostMediaPicker } from "@/components/posts/post-media-picker";
import { PostScheduler } from "@/components/posts/post-scheduler";
import { Alert, Card } from "@/components/ui/card";
import { getDb } from "@/server/db/client";
import { UserFacingError } from "@/server/services/errors";
import { listMedia } from "@/server/services/media";
import { getPost, MAX_MEDIA_PER_POST, schedulingProblems } from "@/server/services/posts";
import { requireWorkspace } from "@/server/session";

export const metadata: Metadata = { title: "Publication" };

export default async function PostPage({ params }: PageProps<"/publications/[postId]">) {
  const { postId } = await params;
  const access = await requireWorkspace();
  const post = await getPost(getDb(), access, postId).catch((error: unknown) => {
    if (error instanceof UserFacingError && error.code === "not_found") notFound();
    throw error;
  });
  const network = SOCIAL_NETWORKS[post.network];
  const images = await listMedia(getDb(), access, 1);
  const local = post.scheduledAt ? toZoned(post.scheduledAt, post.timeZone) : null;
  const provider = getTextProvider();
  const attached = (post.mediaIds ?? []).map((id) => id.toHexString());
  // Les images jointes restent proposées même si elles ne sont plus dans la première page de la médiathèque.
  const choices = [
    ...attached.filter((id) => !images.items.some((item) => item._id.toHexString() === id)).map((id) => ({ id, name: "Image jointe" })),
    ...images.items.map((item) => ({ id: item._id.toHexString(), name: item.name })),
  ];
  const editable = EDITABLE_POST_STATUSES.includes(post.status) && roleHasPermission(access.role, "content:write");

  return (
    <div className="space-y-6">
      <Link href="/publications" className="text-sm text-primary hover:underline">
        ← Toutes les publications
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">{network.label}</h1>
        <p className="text-sm text-muted">{POST_STATUS_LABELS[post.status]}</p>
      </header>
      {post.rationale ? <Alert>{post.rationale}</Alert> : null}
      {!network.allowsTextOnly && attached.length === 0 ? (
        <Alert tone="error">
          {network.label} exige {network.publishableMedia.includes("image") ? "une image" : "une vidéo"} pour publier.
          {network.publishableMedia.includes("image") ? " Choisissez-en une ci-dessous." : " Les vidéos arrivent dans une prochaine étape."}
        </Alert>
      ) : null}
      <Card>
        <PostEditor postId={postId} network={post.network} initialText={post.text} editable={editable} />
      </Card>
      {network.publishableMedia.includes("image") ? (
        <Card className="space-y-3">
          <h2 className="font-semibold">Images</h2>
          <PostMediaPicker
            postId={postId}
            initial={attached}
            images={choices}
            editable={editable}
            max={network.publishableMedia.includes("carousel") ? MAX_MEDIA_PER_POST : 1}
          />
        </Card>
      ) : null}
      <Card className="space-y-3">
        <h2 className="font-semibold">Date de publication</h2>
        {local ? (
          <p className="text-sm text-muted">
            Prévue le {new Date(`${local.date}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })} à {local.time}
          </p>
        ) : (
          <p className="text-sm text-muted">Aucune date pour le moment.</p>
        )}
        <PostScheduler
          postId={postId}
          status={post.status}
          localDate={local?.date ?? ""}
          localTime={local?.time ?? ""}
          timeZone={post.timeZone}
          problems={schedulingProblems(post)}
          canWrite={roleHasPermission(access.role, "content:write")}
          canPublish={roleHasPermission(access.role, "content:publish")}
          canRegenerate={
            Boolean(post.campaignId && post.slotId) &&
            ["draft", "failed"].includes(post.status) &&
            roleHasPermission(access.role, "content:write") &&
            provider.isConfigured() &&
            hasAiConsent(access, provider)
          }
        />
      </Card>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EDITABLE_POST_STATUSES, POST_STATUS_LABELS, roleHasPermission, SOCIAL_NETWORKS } from "@smia/shared";
import { PostEditor } from "@/components/posts/post-editor";
import { Alert, Card } from "@/components/ui/card";
import { getDb } from "@/server/db/client";
import { UserFacingError } from "@/server/services/errors";
import { getPost } from "@/server/services/posts";
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
      {!network.allowsTextOnly ? (
        <Alert>{network.label} exige une image ou une vidéo : vous pourrez l&apos;ajouter avec la médiathèque.</Alert>
      ) : null}
      <Card>
        <PostEditor postId={postId} network={post.network} initialText={post.text} editable={editable} />
      </Card>
      <p className="text-xs text-muted">
        La programmation et la publication automatique arrivent avec le calendrier et la connexion des réseaux.
      </p>
    </div>
  );
}

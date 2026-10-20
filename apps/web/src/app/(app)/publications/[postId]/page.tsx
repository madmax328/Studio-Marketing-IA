import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EDITABLE_POST_STATUSES, METRIC_KEYS, METRIC_LABELS, POST_STATUS_LABELS, roleHasPermission, SOCIAL_NETWORKS, toZoned } from "@smia/shared";
import { getTextProvider } from "@/server/ai";
import { hasAiConsent } from "@/server/services/generation";
import { PostEditor } from "@/components/posts/post-editor";
import { PostAccountPicker } from "@/components/posts/post-account-picker";
import { PostMediaPicker } from "@/components/posts/post-media-picker";
import { PostApprovalPanel } from "@/components/posts/post-approval";
import { PostScheduler } from "@/components/posts/post-scheduler";
import { Alert, Card } from "@/components/ui/card";
import { getDb } from "@/server/db/client";
import { UserFacingError } from "@/server/services/errors";
import { listMedia } from "@/server/services/media";
import { getPost, MAX_MEDIA_PER_POST, needsApproval, postStatusLabel, schedulingProblems } from "@/server/services/posts";
import { listSocialAccounts } from "@/server/services/social-accounts";
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
  const allowVideo = network.publishableMedia.includes("video");
  const choices = [
    ...attached
      .filter((id) => !images.items.some((item) => item._id.toHexString() === id))
      .map((id) => ({ id, name: "Média joint", video: post.mediaKind === "video" })),
    ...images.items
      .filter((item) => allowVideo || item.kind !== "video")
      .map((item) => ({ id: item._id.toHexString(), name: item.name, video: item.kind === "video" })),
  ];
  const editable = EDITABLE_POST_STATUSES.includes(post.status) && roleHasPermission(access.role, "content:write");
  const accounts = (await listSocialAccounts(getDb(), access)).filter((account) => account.network === post.network);
  const chosen = post.socialAccountId ? accounts.find((account) => account._id.equals(post.socialAccountId as NonNullable<typeof post.socialAccountId>)) : null;
  const connectedCount = accounts.filter((account) => account.status === "connected").length;

  return (
    <div className="space-y-6">
      <Link href="/publications" className="text-sm text-primary hover:underline">
        ← Toutes les publications
      </Link>
      <header>
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">{network.label}</h1>
        <p className="text-sm text-muted">{postStatusLabel(post, POST_STATUS_LABELS)}</p>
      </header>
      {post.publishing?.simulated && post.status === "published" ? (
        <Alert>Envoi simulé avec un compte de test : rien n&apos;a été publié sur {network.label}.</Alert>
      ) : null}
      {post.status === "published" && !post.publishing?.simulated ? (
        <Alert tone="success">
          Publiée{post.publishedAt ? ` le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: post.timeZone }).format(post.publishedAt)}` : ""}.
          {post.publishing?.externalUrl ? (
            <>
              {" "}
              <a href={post.publishing.externalUrl} target="_blank" rel="noreferrer" className="underline">
                Voir sur {network.label}
              </a>
            </>
          ) : null}
        </Alert>
      ) : null}
      {post.publishing?.lastError && post.status !== "published" ? (
        <Alert tone="error">
          {post.status === "scheduled" && post.publishing.nextAttemptAt
            ? `Échec temporaire (tentative ${post.publishing.attempts}) : ${post.publishing.lastError} Nouvel essai prévu automatiquement.`
            : `Dernier envoi : ${post.publishing.lastError}`}
        </Alert>
      ) : null}
      {post.status === "processing" ? <Alert>Envoi en cours…</Alert> : null}
      {post.status === "pending_approval" ? (
        <Card className="space-y-3 border-warning/40">
          <h2 className="font-semibold">En attente de validation</h2>
          <p className="text-sm text-muted">
            Cette publication ne partira qu&apos;une fois validée
            {post.approval?.requestedAt
              ? ` (demande du ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: post.timeZone }).format(post.approval.requestedAt)})`
              : ""}
            .
          </p>
          {roleHasPermission(access.role, "content:approve") ? <PostApprovalPanel postId={postId} /> : null}
        </Card>
      ) : null}
      {post.status === "draft" && post.approval?.decision === "rejected" ? (
        <Alert tone="error">
          Changements demandés lors de la validation{post.approval.comment ? ` : « ${post.approval.comment} »` : "."} Modifiez la
          publication puis redemandez la validation.
        </Alert>
      ) : null}
      {post.status === "published" && !post.publishing?.simulated ? (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">Résultats</h2>
            {post.metrics?.collectedAt ? (
              <p className="text-xs text-muted">
                Relevé le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: post.timeZone }).format(post.metrics.collectedAt)}
              </p>
            ) : null}
          </div>
          {post.metrics?.collectedAt ? (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {METRIC_KEYS.filter((key) => typeof post.metrics?.values[key] === "number").map((key) => (
                <div key={key} className="rounded-xl border border-border bg-white/[0.02] p-3">
                  <dt className="text-xs text-muted">{METRIC_LABELS[key]}</dt>
                  <dd className="mt-1 text-xl font-semibold">{new Intl.NumberFormat("fr-FR").format(post.metrics?.values[key] ?? 0)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted">
              {post.metrics?.unsupported
                ? (post.metrics.lastError ?? "Ce réseau ne fournit pas de chiffres pour cette publication.")
                : "Premier relevé environ une heure après la parution, puis mises à jour pendant 30 jours."}
            </p>
          )}
        </Card>
      ) : null}
      {post.rationale ? <Alert>{post.rationale}</Alert> : null}
      {!network.allowsTextOnly && attached.length === 0 ? (
        <Alert tone="error">
          {network.label} exige {network.publishableMedia.includes("image") ? "une image ou une vidéo" : "une vidéo"} pour publier. Choisissez-en
          une ci-dessous, ou créez-la dans la médiathèque.
        </Alert>
      ) : null}
      <Card>
        <PostEditor postId={postId} network={post.network} initialText={post.text} editable={editable} />
      </Card>
      {network.publishableMedia.includes("image") ? (
        <Card className="space-y-3">
          <h2 className="font-semibold">{allowVideo ? "Images ou vidéo" : "Images"}</h2>
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
        <h2 className="font-semibold">Compte {network.label}</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted">
            Aucun compte {network.label} n&apos;est connecté.{" "}
            <Link href="/reseaux" className="text-primary hover:underline">
              Connecter un compte
            </Link>
          </p>
        ) : (
          <>
            <PostAccountPicker
              postId={postId}
              editable={editable}
              selected={chosen ? chosen._id.toHexString() : null}
              accounts={accounts.map((account) => ({
                id: account._id.toHexString(),
                label: `${account.displayName}${account.status === "connected" ? "" : " (à reconnecter)"}`,
              }))}
            />
            {!chosen && connectedCount > 1 ? (
              <Alert tone="error">Plusieurs comptes sont connectés : choisissez celui qui publiera, sinon l&apos;envoi sera refusé.</Alert>
            ) : null}
            {post.socialAccountId && !chosen ? (
              <Alert tone="error">Le compte choisi a été déconnecté : choisissez-en un autre.</Alert>
            ) : null}
          </>
        )}
      </Card>
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
          needsApproval={needsApproval(access)}
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

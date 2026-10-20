import type { Db } from "mongodb";
import { benchmarkTips, computeBenchmarks, engagementOf, type BenchmarkPost, type BenchmarkTip } from "@smia/shared";
import { collections } from "@/server/db/collections";
import { recordAudit } from "@/server/services/audit";
import { assertPermission } from "@/server/services/permissions";
import type { WorkspaceAccess } from "@/server/services/workspaces";

/** Fenêtre des publications prises en compte, et fréquence du recalcul. */
const WINDOW_DAYS = 120;
const REFRESH_HOURS = 24;
const MAX_POSTS = 50_000;

/**
 * Recalcule les repères anonymes une fois par jour (appelé par le planificateur). Seuls les agrégats sont
 * conservés : ni identifiant de compte, ni texte, ni chiffre d'une publication en particulier.
 */
export async function refreshBenchmarks(db: Db, now = new Date(), force = false): Promise<boolean> {
  const c = collections(db);
  const current = await c.benchmarks.findOne({ _id: "global" }, { projection: { computedAt: 1 } });
  if (!force && current && now.getTime() - current.computedAt.getTime() < REFRESH_HOURS * 3600_000) return false;

  const optedOut = await c.workspaces.find({ benchmarkSharing: false }, { projection: { _id: 1 } }).toArray();
  const rows = await c.posts
    .find(
      {
        status: "published",
        publishedAt: { $gte: new Date(now.getTime() - WINDOW_DAYS * 86_400_000) },
        "publishing.simulated": { $ne: true },
        "metrics.collectedAt": { $ne: null },
        workspaceId: { $nin: optedOut.map((workspace) => workspace._id) },
      },
      { projection: { workspaceId: 1, network: 1, publishedAt: 1, timeZone: 1, mediaKind: 1, "metrics.values": 1 } },
    )
    .limit(MAX_POSTS)
    .toArray();

  const posts: BenchmarkPost[] = rows.flatMap((post) => {
    const engagement = post.metrics ? engagementOf(post.metrics.values) : null;
    if (engagement === null || !post.publishedAt) return [];
    return [
      {
        workspaceId: post.workspaceId.toHexString(),
        network: post.network,
        publishedAt: post.publishedAt,
        timeZone: post.timeZone,
        format: post.mediaKind === "video" ? "video" : post.mediaKind === "image" ? "image" : "text",
        engagement,
      },
    ];
  });
  const groups = computeBenchmarks(posts);
  const participants = new Set(posts.map((post) => post.workspaceId)).size;
  await c.benchmarks.replaceOne({ _id: "global" }, { groups, participants, computedAt: now }, { upsert: true });
  return true;
}

/**
 * Conseils tirés des repères, pour les réseaux de l'espace. Réservés aux espaces qui participent :
 * on ne profite des repères qu'en y contribuant.
 */
export async function getBenchmarkTips(db: Db, access: WorkspaceAccess): Promise<{ participating: boolean; tips: BenchmarkTip[]; computedAt: Date | null }> {
  assertPermission(access, "content:read");
  const participating = access.workspace.benchmarkSharing !== false;
  if (!participating) return { participating, tips: [], computedAt: null };
  const doc = await collections(db).benchmarks.findOne({ _id: "global" });
  if (!doc) return { participating, tips: [], computedAt: null };
  const networks = await collections(db).socialAccounts.distinct("network", { workspaceId: access.workspace._id });
  return { participating, tips: benchmarkTips(doc.groups, networks.length > 0 ? networks : undefined), computedAt: doc.computedAt };
}

export async function setBenchmarkSharing(db: Db, access: WorkspaceAccess, userId: string, value: boolean): Promise<void> {
  assertPermission(access, "workspace:manage");
  await collections(db).workspaces.updateOne({ _id: access.workspace._id }, { $set: { benchmarkSharing: value === true, updatedAt: new Date() } });
  await recordAudit(db, { workspaceId: access.workspace._id, actorUserId: userId, action: "workspace.benchmark_sharing", metadata: { value: value === true } });
}

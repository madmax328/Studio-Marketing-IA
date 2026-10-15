import type { Db } from "mongodb";
import { POST_STATUSES, type PostStatus } from "@smia/shared";
import { collections, type PostDoc } from "@/server/db/collections";
import type { WorkspaceAccess } from "@/server/services/workspaces";

export interface DashboardData {
  /** Publications « envoyées » en mode simulation (rien n'est parti), comptées à part. */
  simulatedCount: number;
  brandCount: number;
  connectedAccountCount: number;
  postsByStatus: Record<PostStatus, number>;
  upcomingPosts: Pick<PostDoc, "_id" | "network" | "text" | "scheduledAt" | "timeZone">[];
}

/** Données réelles du tableau de bord, toutes filtrées par espace de travail. */
export async function getDashboardData(db: Db, access: WorkspaceAccess): Promise<DashboardData> {
  const c = collections(db);
  const workspaceId = access.workspace._id;

  const [simulatedCount, brandCount, connectedAccountCount, statusCounts, upcomingPosts] = await Promise.all([
    c.posts.countDocuments({ workspaceId, status: "published", "publishing.simulated": true }),
    c.brands.countDocuments({ workspaceId }),
    c.socialAccounts.countDocuments({ workspaceId, status: "connected" }),
    c.posts
      .aggregate<{ _id: PostStatus; count: number }>([
        { $match: { workspaceId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])
      .toArray(),
    c.posts
      .find(
        { workspaceId, status: "scheduled", scheduledAt: { $gte: new Date() } },
        { projection: { network: 1, text: 1, scheduledAt: 1, timeZone: 1 } },
      )
      .sort({ scheduledAt: 1 })
      .limit(5)
      .toArray(),
  ]);

  const postsByStatus = Object.fromEntries(POST_STATUSES.map((s) => [s, 0])) as Record<PostStatus, number>;
  for (const { _id, count } of statusCounts) postsByStatus[_id] = count;
  postsByStatus.published -= simulatedCount;

  return { simulatedCount, brandCount, connectedAccountCount, postsByStatus, upcomingPosts };
}

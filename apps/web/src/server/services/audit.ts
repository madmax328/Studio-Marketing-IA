import type { Db, ObjectId } from "mongodb";
import { collections, type AuditLogDoc } from "@/server/db/collections";

/** Enregistre un événement sensible. Ne jamais y placer de secret ni de contenu privé. */
export async function recordAudit(
  db: Db,
  entry: {
    workspaceId: ObjectId | null;
    actorUserId: string | null;
    action: string;
    targetId?: string | null;
    metadata?: AuditLogDoc["metadata"];
  },
): Promise<void> {
  await collections(db).auditLogs.insertOne({
    workspaceId: entry.workspaceId,
    actorUserId: entry.actorUserId,
    action: entry.action,
    targetId: entry.targetId ?? null,
    metadata: entry.metadata ?? {},
    createdAt: new Date(),
  } as AuditLogDoc);
}

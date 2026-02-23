import { eq } from "drizzle-orm";
import type { db as dbType } from "~/server/db";
import { agents, auditLog } from "~/server/db/schema";

type Db = typeof dbType;

/**
 * Resolve the internal agent ID from a Supabase auth user ID.
 * Returns null if the user is not an agent.
 */
export async function resolveAgentId(db: Db, userId: string) {
  const [row] = await db
    .select({ id: agents.id, email: agents.email })
    .from(agents)
    .where(eq(agents.userId, userId))
    .limit(1);
  return row ?? null;
}

/**
 * Write an entry to the audit_log table.
 *
 * @param db       – drizzle DB instance
 * @param params   – audit fields
 */
export async function writeAuditLog(
  db: Db,
  params: {
    tableName: string;
    recordId: string;
    action: "create" | "update" | "delete";
    actorId: string | null;
    actorEmail: string | null;
    oldData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
  },
) {
  await db.insert(auditLog).values({
    tableName: params.tableName,
    recordId: params.recordId,
    action: params.action,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    oldData: params.oldData ?? {},
    newData: params.newData ?? {},
  });
}

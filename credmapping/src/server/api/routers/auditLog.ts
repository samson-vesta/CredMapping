import { z } from "zod";
import { eq, desc, gte, lte, ilike, and, inArray, sql, count } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  auditLog,
  providerFacilityCredentials,
  providerStateLicenses,
  providerVestaPrivileges,
  workflowPhases,
  facilityContacts,
  facilityPreliveInfo,
} from "~/server/db/schema";

export const auditLogRouter = createTRPCRouter({
  /**
   * Entity-scoped activity feed.
   * Returns audit entries for an entity and all its child records.
   * For a provider: provider + licenses + privileges + PFC + workflow phases.
   * For a facility: facility + contacts + prelive + PFC + workflow phases.
   */
  listByEntity: protectedProcedure
    .input(
      z.object({
        entityType: z.enum(["provider", "facility"]),
        entityId: z.string().uuid(),
        limit: z.number().default(30),
        offset: z.number().default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Collect all record IDs to include
      const recordIds: string[] = [input.entityId];

      if (input.entityType === "provider") {
        const [licenseIds, privIds, pfcIds] = await Promise.all([
          ctx.db
            .select({ id: providerStateLicenses.id })
            .from(providerStateLicenses)
            .where(eq(providerStateLicenses.providerId, input.entityId)),
          ctx.db
            .select({ id: providerVestaPrivileges.id })
            .from(providerVestaPrivileges)
            .where(eq(providerVestaPrivileges.providerId, input.entityId)),
          ctx.db
            .select({ id: providerFacilityCredentials.id })
            .from(providerFacilityCredentials)
            .where(eq(providerFacilityCredentials.providerId, input.entityId)),
        ]);

        recordIds.push(
          ...licenseIds.map((r) => r.id),
          ...privIds.map((r) => r.id),
          ...pfcIds.map((r) => r.id),
        );

        // Also get workflow phases linked to the PFC records
        if (pfcIds.length > 0) {
          const wfIds = await ctx.db
            .select({ id: workflowPhases.id })
            .from(workflowPhases)
            .where(inArray(workflowPhases.relatedId, pfcIds.map((r) => r.id)));
          recordIds.push(...wfIds.map((r) => r.id));
        }
      } else {
        const [contactIds, preliveIds, pfcIds] = await Promise.all([
          ctx.db
            .select({ id: facilityContacts.id })
            .from(facilityContacts)
            .where(eq(facilityContacts.facilityId, input.entityId)),
          ctx.db
            .select({ id: facilityPreliveInfo.id })
            .from(facilityPreliveInfo)
            .where(eq(facilityPreliveInfo.facilityId, input.entityId)),
          ctx.db
            .select({ id: providerFacilityCredentials.id })
            .from(providerFacilityCredentials)
            .where(eq(providerFacilityCredentials.facilityId, input.entityId)),
        ]);

        recordIds.push(
          ...contactIds.map((r) => r.id),
          ...preliveIds.map((r) => r.id),
          ...pfcIds.map((r) => r.id),
        );

        if (pfcIds.length > 0) {
          const wfIds = await ctx.db
            .select({ id: workflowPhases.id })
            .from(workflowPhases)
            .where(inArray(workflowPhases.relatedId, pfcIds.map((r) => r.id)));
          recordIds.push(...wfIds.map((r) => r.id));
        }
      }

      const rows = await ctx.db
        .select()
        .from(auditLog)
        .where(inArray(auditLog.recordId, recordIds))
        .orderBy(desc(auditLog.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  list: protectedProcedure
    .input(
      z.object({
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        action: z.enum(["all", "insert", "update", "delete"]).optional(),
        tableName: z.string().optional(),
        actorEmail: z.string().optional(),
        recordId: z.string().optional(),
        dataContent: z.string().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.fromDate)
        conditions.push(gte(auditLog.createdAt, new Date(input.fromDate)));
      if (input.toDate) {
        // Add 1 day to include the entire day
        const toDate = new Date(input.toDate);
        toDate.setDate(toDate.getDate() + 1);
        conditions.push(lte(auditLog.createdAt, toDate));
      }
      if (input.action && input.action !== "all")
        conditions.push(eq(auditLog.action, input.action));
      if (input.tableName && input.tableName !== "all")
        conditions.push(eq(auditLog.tableName, input.tableName));
      if (input.actorEmail)
        conditions.push(ilike(auditLog.actorEmail, `%${input.actorEmail}%`));
      if (input.recordId)
        conditions.push(
          ilike(sql`${auditLog.recordId}::text`, `%${input.recordId}%`)
        );

      // Get total count
      const countResult = await ctx.db
        .select({ count: count() })
        .from(auditLog)
        .where(conditions.length ? and(...conditions) : undefined);

      const total = countResult[0]?.count ?? 0;

      // Get paginated rows
      const rows = await ctx.db
        .select()
        .from(auditLog)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(auditLog.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return { rows, total };
    }),
});

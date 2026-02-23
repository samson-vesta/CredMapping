import { z } from "zod";
import { eq, desc, count, and, sql, or, inArray } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  commLogs,
  providers,
  facilities,
  agents,
  providerFacilityCredentials,
  facilityContacts,
} from "~/server/db/schema";

export const commLogsRouter = createTRPCRouter({
  /**
   * Get all comm logs for a specific provider
   */
  listByProvider: protectedProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: commLogs.id,
          relatedType: commLogs.relatedType,
          relatedId: commLogs.relatedId,
          subject: commLogs.subject,
          status: commLogs.status,
          commType: commLogs.commType,
          requestedAt: commLogs.requestedAt,
          lastFollowupAt: commLogs.lastFollowupAt,
          nextFollowupAt: commLogs.nextFollowupAt,
          receivedAt: commLogs.receivedAt,
          notes: commLogs.notes,
          createdBy: commLogs.createdBy,
          lastUpdatedBy: commLogs.lastUpdatedBy,
          createdAt: commLogs.createdAt,
          updatedAt: commLogs.updatedAt,
        })
        .from(commLogs)
        .where(
          and(
            eq(commLogs.relatedType, "provider"),
            eq(commLogs.relatedId, input.providerId),
          ),
        )
        .orderBy(desc(commLogs.createdAt));

      const agentIds = Array.from(
        new Set(
          rows.flatMap((row) => [row.createdBy, row.lastUpdatedBy]).filter((id): id is string => id != null),
        ),
      );

      const agentRows = agentIds.length
        ? await ctx.db
            .select({ id: agents.id, firstName: agents.firstName, lastName: agents.lastName })
            .from(agents)
            .where(inArray(agents.id, agentIds))
        : [];

      const agentNameById = new Map(
        agentRows.map((agent) => [
          agent.id,
          [agent.firstName, agent.lastName].filter(Boolean).join(" ").trim(),
        ]),
      );

      return rows.map((row) => ({
        ...row,
        agentName: row.createdBy ? (agentNameById.get(row.createdBy) ?? null) : null,
        createdByName: row.createdBy ? (agentNameById.get(row.createdBy) ?? null) : null,
        lastUpdatedByName: row.lastUpdatedBy ? (agentNameById.get(row.lastUpdatedBy) ?? null) : null,
      }));
    }),

  /**
   * Get all comm logs for a specific facility
   */
  listByFacility: protectedProcedure
    .input(z.object({ facilityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: commLogs.id,
          relatedType: commLogs.relatedType,
          relatedId: commLogs.relatedId,
          subject: commLogs.subject,
          status: commLogs.status,
          commType: commLogs.commType,
          requestedAt: commLogs.requestedAt,
          lastFollowupAt: commLogs.lastFollowupAt,
          nextFollowupAt: commLogs.nextFollowupAt,
          receivedAt: commLogs.receivedAt,
          notes: commLogs.notes,
          createdBy: commLogs.createdBy,
          lastUpdatedBy: commLogs.lastUpdatedBy,
          createdAt: commLogs.createdAt,
          updatedAt: commLogs.updatedAt,
        })
        .from(commLogs)
        .where(
          and(
            eq(commLogs.relatedType, "facility"),
            eq(commLogs.relatedId, input.facilityId),
            sql`(${commLogs.subject} NOT ILIKE 'CRED%' OR ${commLogs.subject} IS NULL)`,
            sql`(${commLogs.subject} NOT ILIKE 'NON-CRED%' OR ${commLogs.subject} IS NULL)`
          ),
        )
        .orderBy(desc(commLogs.createdAt));

      const agentIds = Array.from(
        new Set(
          rows.flatMap((row) => [row.createdBy, row.lastUpdatedBy]).filter((id): id is string => id != null),
        ),
      );

      const agentRows = agentIds.length
        ? await ctx.db
            .select({ id: agents.id, firstName: agents.firstName, lastName: agents.lastName })
            .from(agents)
            .where(inArray(agents.id, agentIds))
        : [];

      const agentNameById = new Map(
        agentRows.map((agent) => [
          agent.id,
          [agent.firstName, agent.lastName].filter(Boolean).join(" ").trim(),
        ]),
      );

      return rows.map((row) => ({
        ...row,
        agentName: row.createdBy ? (agentNameById.get(row.createdBy) ?? null) : null,
        createdByName: row.createdBy ? (agentNameById.get(row.createdBy) ?? null) : null,
        lastUpdatedByName: row.lastUpdatedBy ? (agentNameById.get(row.lastUpdatedBy) ?? null) : null,
      }));
    }),

  /**
   * Create a new comm log entry
   */
  create: protectedProcedure
    .input(
      z.object({
        relatedType: z.enum(["provider", "facility"]),
        relatedId: z.string().uuid(),
        commType: z.string(),
        subject: z.string().optional(),
        notes: z.string().optional(),
        status: z.string().optional(),
        requestedAt: z.string().optional(),
        lastFollowupAt: z.string().optional(),
        nextFollowupAt: z.string().optional(),
        receivedAt: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const parsedUserId = z.string().uuid().safeParse(ctx.user.id);
      const [currentAgent] = parsedUserId.success
        ? await ctx.db
            .select({ id: agents.id })
            .from(agents)
            .where(eq(agents.userId, parsedUserId.data))
            .limit(1)
        : [];

      const result = await ctx.db
        .insert(commLogs)
        .values([
          {
            relatedType: input.relatedType,
            relatedId: input.relatedId,
            commType: input.commType,
            subject: input.subject ?? null,
            notes: input.notes ?? null,
            status: input.status ?? null,
            requestedAt: input.requestedAt
              ? new Date(input.requestedAt)
              : null,
            lastFollowupAt: input.lastFollowupAt
              ? new Date(input.lastFollowupAt)
              : null,
            nextFollowupAt: input.nextFollowupAt
              ? new Date(input.nextFollowupAt)
              : null,
            receivedAt: input.receivedAt ? new Date(input.receivedAt) : null,
            createdBy: currentAgent?.id ?? null,
            createdAt: new Date(),
          } as never,
        ])
        .returning();

      return result[0];
    }),

  /**
   * Update an existing comm log entry
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        commType: z.string(),
        subject: z.string().optional(),
        notes: z.string().optional(),
        status: z.string().optional(),
        requestedAt: z.string().optional(),
        lastFollowupAt: z.string().optional(),
        nextFollowupAt: z.string().optional(),
        receivedAt: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const parsedUserId = z.string().uuid().safeParse(ctx.user.id);
      const [currentAgent] = parsedUserId.success
        ? await ctx.db
            .select({ id: agents.id })
            .from(agents)
            .where(eq(agents.userId, parsedUserId.data))
            .limit(1)
        : [];

      const result = await ctx.db
        .update(commLogs)
        .set({
          commType: input.commType,
          subject: input.subject ?? null,
          notes: input.notes ?? null,
          status: input.status ?? null,
          requestedAt: input.requestedAt ? new Date(input.requestedAt) : null,
          lastFollowupAt: input.lastFollowupAt
            ? new Date(input.lastFollowupAt)
            : null,
          nextFollowupAt: input.nextFollowupAt
            ? new Date(input.nextFollowupAt)
            : null,
          receivedAt: input.receivedAt ? new Date(input.receivedAt) : null,
          lastUpdatedBy: currentAgent?.id ?? null,
          updatedAt: new Date(),
        } as never)
        .where(eq(commLogs.id, input.id))
        .returning();

      return result[0];
    }),

  /**
   * Get summary stats for a provider
   */
  getProviderSummary: protectedProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [logStats] = await ctx.db
        .select({
          totalLogs: count(),
          latestFollowupAt: sql<Date | null>`MAX(${commLogs.lastFollowupAt})`,
          nextFollowupAt: sql<Date | null>`MAX(${commLogs.nextFollowupAt})`,
        })
        .from(commLogs)
        .where(
          and(
            eq(commLogs.relatedType, "provider"),
            eq(commLogs.relatedId, input.providerId),
            sql`(${commLogs.subject} NOT ILIKE 'CRED%' OR ${commLogs.subject} IS NULL)`,
            sql`(${commLogs.subject} NOT ILIKE 'NON-CRED%' OR ${commLogs.subject} IS NULL)`
          ),
        );

      return {
        totalLogs: logStats?.totalLogs ?? 0,
        latestFollowupAt: logStats?.latestFollowupAt ?? null,
        nextFollowupAt: logStats?.nextFollowupAt ?? null,
        openTasksCount: 0,
      };
    }),

  /**
   * Get pending PSVs for a specific provider
   */
  getPendingPSVsByProvider: protectedProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: providerFacilityCredentials.id,
          facilityType: providerFacilityCredentials.facilityType,
          privileges: providerFacilityCredentials.privileges,
          decision: providerFacilityCredentials.decision,
          notes: providerFacilityCredentials.notes,
          applicationRequired: providerFacilityCredentials.applicationRequired,
          priority: providerFacilityCredentials.priority,
          createdAt: providerFacilityCredentials.createdAt,
          facilityName: facilities.name,
        })
        .from(providerFacilityCredentials)
        .leftJoin(
          facilities,
          eq(providerFacilityCredentials.facilityId, facilities.id)
        )
        .where(eq(providerFacilityCredentials.providerId, input.providerId))
        .orderBy(desc(providerFacilityCredentials.createdAt));

      return rows;
    }),

  /**
   * Get summary stats for a facility
   */
  getFacilitySummary: protectedProcedure
    .input(z.object({ facilityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [logStats] = await ctx.db
        .select({
          totalLogs: count(),
          latestFollowupAt: sql<Date | null>`MAX(${commLogs.lastFollowupAt})`,
          nextFollowupAt: sql<Date | null>`MAX(${commLogs.nextFollowupAt})`,
        })
        .from(commLogs)
        .where(
          and(
            eq(commLogs.relatedType, "facility"),
            eq(commLogs.relatedId, input.facilityId),
            sql`(${commLogs.subject} NOT ILIKE 'CRED%' OR ${commLogs.subject} IS NULL)`,
            sql`(${commLogs.subject} NOT ILIKE 'NON-CRED%' OR ${commLogs.subject} IS NULL)`
          ),
        );

      return {
        totalLogs: logStats?.totalLogs ?? 0,
        latestFollowupAt: logStats?.latestFollowupAt ?? null,
        nextFollowupAt: logStats?.nextFollowupAt ?? null,
        openTasksCount: 0,
      };
    }),

  /**
   * Get missing docs (CRED/NON-CRED) for a specific facility
   */
  getMissingDocsByFacility: protectedProcedure
    .input(z.object({ facilityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const allLogs = await ctx.db
        .select({
          id: commLogs.id,
          commType: commLogs.commType,
          subject: commLogs.subject,
          status: commLogs.status,
          notes: commLogs.notes,
          lastFollowupAt: commLogs.lastFollowupAt,
          nextFollowupAt: commLogs.nextFollowupAt,
          createdAt: commLogs.createdAt,
        })
        .from(commLogs)
        .where(
          and(
            eq(commLogs.relatedType, "facility"),
            eq(commLogs.relatedId, input.facilityId),
            or(
              sql`${commLogs.subject} ILIKE 'CRED%'`,
              sql`${commLogs.subject} ILIKE 'NON-CRED%'`
            )
          )
        )
        .orderBy(desc(commLogs.createdAt));

      return {
        cred: allLogs.filter((l) => l.subject?.toUpperCase().startsWith("CRED")),
        nonCred: allLogs.filter((l) =>
          l.subject?.toUpperCase().startsWith("NON-CRED")
        ),
      };
    }),

  /**
   * Get contacts and facility info for a specific facility
   */
  getContactsByFacility: protectedProcedure
    .input(z.object({ facilityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const contacts = await ctx.db
        .select()
        .from(facilityContacts)
        .where(eq(facilityContacts.facilityId, input.facilityId))
        .orderBy(desc(facilityContacts.isPrimary));

      const facility = await ctx.db
        .select({
          proxy: facilities.proxy,
          tatSla: facilities.tatSla,
          address: facilities.address,
          status: facilities.status,
        })
        .from(facilities)
        .where(eq(facilities.id, input.facilityId))
        .limit(1);

      return {
        contacts,
        facilityInfo: facility[0] ?? null,
      };
    }),
});

/**
 * Get providers with their latest comm log status
 * Used for the left panel provider list
 */
export const providersWithCommLogsRouter = createTRPCRouter({
  listWithCommLogStatus: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        filter: z
          .enum(["all", "past-due", "due-today", "pending", "completed"])
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let rows = await ctx.db
        .select({
          id: providers.id,
          firstName: providers.firstName,
          lastName: providers.lastName,
          degree: providers.degree,
          email: providers.email,
          nextFollowupAt: sql<Date | null>`
            (SELECT MAX(${commLogs.nextFollowupAt}) 
             FROM ${commLogs} 
             WHERE ${commLogs.relatedType} = 'provider' 
             AND ${commLogs.relatedId} = ${providers.id})
          `,
          latestStatus: sql<string | null>`
            (SELECT ${commLogs.status} 
             FROM ${commLogs} 
             WHERE ${commLogs.relatedType} = 'provider' 
             AND ${commLogs.relatedId} = ${providers.id}
             ORDER BY ${commLogs.createdAt} DESC
             LIMIT 1)
          `,
        })
        .from(providers);

      if (input.search) {
        rows = rows.filter(
          (p) =>
            `${p.firstName} ${p.lastName}`.toLowerCase().includes(input.search?.toLowerCase() ?? "") ||
            p.email?.toLowerCase().includes(input.search?.toLowerCase() ?? ""),
        );
      }

      if (input.filter && input.filter !== "all") {
        rows = rows.filter((p) => {
          const nextFollowup = p.nextFollowupAt ? new Date(p.nextFollowupAt) : null;

          if (input.filter === "past-due") {
            return nextFollowup && nextFollowup < today;
          }
          if (input.filter === "due-today") {
            return nextFollowup && nextFollowup >= today && nextFollowup < tomorrow;
          }
          if (input.filter === "pending") {
            return p.latestStatus === "pending_response";
          }
          if (input.filter === "completed") {
            return p.latestStatus === "fu_completed";
          }

          return true;
        });
      }

      return rows;
    }),
});

/**
 * Get facilities with their latest comm log status
 * Used for the left panel facility list
 */
export const facilitiesWithCommLogsRouter = createTRPCRouter({
  listWithCommLogStatus: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        filter: z
          .enum(["all", "cred", "non-cred", "past-due", "pending"])
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let rows = await ctx.db
        .select({
          id: facilities.id,
          name: facilities.name,
          state: facilities.state,
          status: facilities.status,
          nextFollowupAt: sql<Date | null>`
            (SELECT MAX(${commLogs.nextFollowupAt}) 
             FROM ${commLogs} 
             WHERE ${commLogs.relatedType} = 'facility' 
             AND ${commLogs.relatedId} = ${facilities.id})
          `,
          latestStatus: sql<string | null>`
            (SELECT ${commLogs.status} 
             FROM ${commLogs} 
             WHERE ${commLogs.relatedType} = 'facility' 
             AND ${commLogs.relatedId} = ${facilities.id}
             ORDER BY ${commLogs.createdAt} DESC
             LIMIT 1)
          `,
        })
        .from(facilities);

      if (input.search) {
        const searchLower = input.search?.toLowerCase() ?? "";
        rows = rows.filter((f) => {
          const nameMatch = (f.name?.toLowerCase()?.includes(searchLower)) ?? false;
          const stateMatch = (f.state?.toLowerCase()?.includes(searchLower)) ?? false;
          return nameMatch || stateMatch;
        });
      }

      if (input.filter && input.filter !== "all") {
        rows = rows.filter((f) => {
          const nextFollowup = f.nextFollowupAt ? new Date(f.nextFollowupAt) : null;

          if (input.filter === "cred") {
            return f.status === "Active";
          }
          if (input.filter === "non-cred") {
            return f.status !== "Active";
          }
          if (input.filter === "past-due") {
            return nextFollowup && nextFollowup < today;
          }
          if (input.filter === "pending") {
            return f.latestStatus === "pending_response";
          }

          return true;
        });
      }

      return rows;
    }),
});

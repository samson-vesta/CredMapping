import { z } from "zod";
import { eq, desc, count, and, sql, inArray } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  commLogs,
  providers,
  facilities,
  agents,
  facilityContacts,
  missingDocs,
  pendingPSV,
} from "~/server/db/schema";

export const commLogsRouter = createTRPCRouter({
   // listByProvider: Gets the activity feed for the right panel
  listByProvider: protectedProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: commLogs.id,
          relatedType: commLogs.relatedType,
          relatedId: commLogs.relatedId,
          subject: commLogs.subject,
          commType: commLogs.commType,
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
          rows
            .flatMap((row) => [row.createdBy, row.lastUpdatedBy])
            .filter((id): id is string => id != null),
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

  // create: Log a new interaction
  create: protectedProcedure
    .input(
      z.object({
        relatedType: z.enum(["provider", "facility"]),
        relatedId: z.string().uuid(),
        commType: z.string(),
        subject: z.string().optional(),
        notes: z.string().optional(),
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
        .values({
          relatedType: input.relatedType,
          relatedId: input.relatedId,
          commType: input.commType,
          subject: input.subject ?? null,
          notes: input.notes ?? null,
          createdBy: currentAgent?.id ?? null,
        })
        .returning();

      return result[0];
    }),

  // getMissingDocs: Fetches active roadblocks for the right panel
  getMissingDocs: protectedProcedure
    .input(z.object({ 
      relatedId: z.string().uuid(), 
      relatedType: z.enum(["provider", "facility"]) 
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.db
        .select()
        .from(missingDocs)
        .where(
          and(
            eq(missingDocs.relatedId, input.relatedId),
            eq(missingDocs.relatedType, input.relatedType)
          )
        )
        .orderBy(desc(missingDocs.updatedAt));
    }),

  // getPendingPSVs: Fetches PSV checklist for the right panel (Provider only)
  getPendingPSVs: protectedProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db
        .select()
        .from(pendingPSV)
        .where(eq(pendingPSV.providerId, input.providerId))
        .orderBy(desc(pendingPSV.updatedAt));
    }),

  // getSummary: A quick stats overview for the top of the detail panel
  getSummary: protectedProcedure
    .input(z.object({ 
      relatedId: z.string().uuid(), 
      relatedType: z.enum(["provider", "facility"]) 
    }))
    .query(async ({ ctx, input }) => {
      const logs = await ctx.db
        .select({ count: count() })
        .from(commLogs)
        .where(and(eq(commLogs.relatedId, input.relatedId), eq(commLogs.relatedType, input.relatedType)));

      const docs = await ctx.db
        .select({ count: count() })
        .from(missingDocs)
        .where(and(eq(missingDocs.relatedId, input.relatedId), eq(missingDocs.relatedType, input.relatedType)));

      return {
        totalLogs: logs[0]?.count ?? 0,
        activeRoadblocks: docs[0]?.count ?? 0,
      };
    }),

  // listByFacility: Gets activity feed for the facility detail panel
  listByFacility: protectedProcedure
    .input(z.object({ facilityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: commLogs.id,
          relatedType: commLogs.relatedType,
          relatedId: commLogs.relatedId,
          subject: commLogs.subject,
          commType: commLogs.commType,
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
          ),
        )
        .orderBy(desc(commLogs.createdAt));

      const agentIds = Array.from(new Set(rows.flatMap((r) => [r.createdBy, r.lastUpdatedBy]).filter((id): id is string => id != null)));
      const agentRows = agentIds.length ? await ctx.db.select({ id: agents.id, firstName: agents.firstName, lastName: agents.lastName }).from(agents).where(inArray(agents.id, agentIds)) : [];
      const agentNameById = new Map(agentRows.map((a) => [a.id, `${a.firstName} ${a.lastName}`.trim()]));

      return rows.map((row) => ({
        ...row,
        agentName: row.createdBy ? (agentNameById.get(row.createdBy) ?? null) : null,
        createdByName: row.createdBy ? (agentNameById.get(row.createdBy) ?? null) : null,
        lastUpdatedByName: row.lastUpdatedBy ? (agentNameById.get(row.lastUpdatedBy) ?? null) : null,
      }));
    }),

  // update: Edit an existing log entry
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        commType: z.string(),
        subject: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const parsedUserId = z.string().uuid().safeParse(ctx.user.id);
      const [currentAgent] = parsedUserId.success
        ? await ctx.db.select({ id: agents.id }).from(agents).where(eq(agents.userId, parsedUserId.data)).limit(1)
        : [];

      const result = await ctx.db
        .update(commLogs)
        .set({
          commType: input.commType,
          subject: input.subject ?? null,
          notes: input.notes ?? null,
          lastUpdatedBy: currentAgent?.id ?? null,
          updatedAt: new Date(),
        })
        .where(eq(commLogs.id, input.id))
        .returning();

      return result[0];
    }),

  // getContactsAndFacilityInfo: Fetches specific facility details for the right panel
  getContactsAndFacilityInfo: protectedProcedure
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
          email: facilities.email,
          name: facilities.name,
          state: facilities.state,
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

export const providersWithCommLogsRouter = createTRPCRouter({
  listWithCommLogStatus: protectedProcedure
    .input(z.object({ search: z.string().optional(), filter: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: providers.id,
          firstName: providers.firstName,
          lastName: providers.lastName,
          degree: providers.degree,
          email: providers.email,
          hasMissingDocs: sql<boolean>`CASE WHEN ${missingDocs.id} IS NOT NULL THEN TRUE ELSE FALSE END`,
          hasPSV: sql<boolean>`CASE WHEN ${pendingPSV.id} IS NOT NULL THEN TRUE ELSE FALSE END`,
          latestStatus: sql<string | null>`
            CASE 
              WHEN ${missingDocs.id} IS NOT NULL THEN 'Missing Docs'
              WHEN ${pendingPSV.id} IS NOT NULL THEN 'PSV: ' || ${pendingPSV.status}
              ELSE (SELECT ${commLogs.subject} FROM ${commLogs} WHERE ${commLogs.relatedId}::text = ${providers.id}::text AND ${commLogs.relatedType} = 'provider' ORDER BY ${commLogs.createdAt} DESC LIMIT 1)
            END
          `,
          nextFollowupAt: sql<Date | null>`
            (SELECT MIN(d) FROM (
              SELECT ${missingDocs.nextFollowUp} as d 
              FROM ${missingDocs} 
              WHERE ${missingDocs.relatedId}::text = ${providers.id}::text 
              AND ${missingDocs.relatedType} = 'provider'
              UNION
              SELECT ${pendingPSV.nextFollowUp} as d 
              FROM ${pendingPSV} 
              WHERE ${pendingPSV.providerId}::text = ${providers.id}::text
            ) as combined_dates)
          `,
        })
        .from(providers)
        .leftJoin(missingDocs, and(
          sql`${missingDocs.relatedId}::text = ${providers.id}::text`,
          eq(missingDocs.relatedType, "provider")
        ))
        .leftJoin(pendingPSV, sql`${pendingPSV.providerId}::text = ${providers.id}::text`);

      let filteredRows = rows;

      if (input.filter === "psv") {
        filteredRows = rows.filter((r) => r.hasPSV === true);
      } else if (input.filter === "missing-docs") {
        filteredRows = rows.filter((r) => r.hasMissingDocs === true);
      } else if (input.filter === "completed") {
        filteredRows = rows.filter((r) => !r.hasMissingDocs && !r.hasPSV);
      }

      if (input.search) {
        const q = input.search.toLowerCase();
        filteredRows = filteredRows.filter(p => 
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
        );
      }
      return filteredRows;
    }),
});

export const facilitiesWithCommLogsRouter = createTRPCRouter({
  listWithCommLogStatus: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        filter: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: facilities.id,
          name: facilities.name,
          state: facilities.state,
          status: facilities.status,
          hasMissingDocs: sql<boolean>`CASE WHEN ${missingDocs.id} IS NOT NULL THEN TRUE ELSE FALSE END`,
          latestStatus: sql<string>`CASE WHEN ${missingDocs.id} IS NOT NULL THEN 'Missing Docs' ELSE 'General' END`
        })
        .from(facilities)
        .leftJoin(missingDocs, 
          and(
            sql`${missingDocs.relatedId}::text = ${facilities.id}::text`,
            eq(missingDocs.relatedType, "facility")
          )
        );

      let filteredRows = rows;

      if (input.filter === "missing-docs") {
        filteredRows = rows.filter((r) => r.hasMissingDocs === true);
      } else if (input.filter === "general") {
        filteredRows = rows.filter((r) => r.hasMissingDocs === false);
      }

      if (input.search) {
        const q = input.search.toLowerCase();
        filteredRows = filteredRows.filter(
          (f) =>
            f.name?.toLowerCase().includes(q) ??
            f.state?.toLowerCase().includes(q),
        );
      }

      return filteredRows;
    }),
});

import { z } from "zod";
import { and, count, desc, eq, exists, ilike, inArray, max, ne, or } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { resolveAgentId, writeAuditLog } from "~/server/api/audit";
import {
  commLogs,
  providers,
  facilities,
  agents,
  facilityContacts,
  missingDocs,
  pendingPSV,
  providerVestaPrivileges,
} from "~/server/db/schema";

const getEarliestFollowUp = (
  ...dates: Array<string | null | undefined>
): string | null => {
  const validDates = dates.filter((date): date is string => Boolean(date));
  if (validDates.length === 0) return null;
  return validDates.reduce((earliest, current) =>
    current < earliest ? current : earliest,
  );
};

const getLatestActivityDate = (
  ...values: Array<Date | string | null | undefined>
): Date | null => {
  let latest: Date | null = null;

  for (const value of values) {
    if (!value) continue;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) continue;
    if (!latest || parsed.getTime() > latest.getTime()) latest = parsed;
  }

  return latest;
};

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

      const [created] = result;
      if (!created) throw new Error("Failed to create comm log.");

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "comm_logs",
        recordId: created.id,
        action: "create",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        newData: { ...created, subject: null, notes: null } as unknown as Record<string, unknown>,
      });

      return created;
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

  createMissingDoc: protectedProcedure
    .input(
      z.object({
        relatedType: z.enum(["provider", "facility"]),
        relatedId: z.string().uuid(),
        information: z.string().min(1),
        roadblocks: z.string().optional(),
        nextFollowUp: z.string().date().optional(),
        nextFollowUpUS: z.string().date().optional(),
        nextFollowUpIn: z.string().date().optional(),
        followUpStatus: z.enum(["Completed", "Pending Response", "Not Completed"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nextFollowUpUS = input.nextFollowUpUS ?? input.nextFollowUp ?? null;
      const nextFollowUpIn = input.nextFollowUpIn ?? input.nextFollowUp ?? null;

      const result = await ctx.db
        .insert(missingDocs)
        .values({
          relatedType: input.relatedType,
          relatedId: input.relatedId,
          information: input.information,
          roadblocks: input.roadblocks ?? null,
          nextFollowUpUS,
          nextFollowUpIn,
          followUpStatus: input.followUpStatus ?? "Not Completed",
          updatedAt: new Date(),
        })
        .returning();

      const [created] = result;
      if (!created) throw new Error("Failed to create missing doc.");

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "missing_docs",
        recordId: created.id,
        action: "create",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        newData: created as unknown as Record<string, unknown>,
      });

      return created;
    }),

  updateMissingDoc: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        information: z.string().min(1),
        roadblocks: z.string().optional(),
        nextFollowUp: z.string().date().optional(),
        nextFollowUpUS: z.string().date().optional(),
        nextFollowUpIn: z.string().date().optional(),
        followUpStatus: z.enum(["Completed", "Pending Response", "Not Completed"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nextFollowUpUS = input.nextFollowUpUS ?? input.nextFollowUp ?? null;
      const nextFollowUpIn = input.nextFollowUpIn ?? input.nextFollowUp ?? null;

      const [existing] = await ctx.db
        .select()
        .from(missingDocs)
        .where(eq(missingDocs.id, input.id))
        .limit(1);

      const result = await ctx.db
        .update(missingDocs)
        .set({
          information: input.information,
          roadblocks: input.roadblocks ?? null,
          nextFollowUpUS,
          nextFollowUpIn,
          followUpStatus: input.followUpStatus ?? "Not Completed",
          updatedAt: new Date(),
        })
        .where(eq(missingDocs.id, input.id))
        .returning();

      const [updated] = result;
      if (!updated) throw new Error("Missing doc not found.");

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "missing_docs",
        recordId: input.id,
        action: "update",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        oldData: existing as unknown as Record<string, unknown>,
        newData: updated as unknown as Record<string, unknown>,
      });

      return updated;
    }),

  deleteMissingDoc: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .delete(missingDocs)
        .where(eq(missingDocs.id, input.id))
        .returning();

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      const deleted = result[0] ?? null;
      if (deleted) {
        await writeAuditLog(ctx.db, {
          tableName: "missing_docs",
          recordId: deleted.id,
          action: "delete",
          actorId: actor?.id ?? null,
          actorEmail: actor?.email ?? ctx.user.email ?? null,
          oldData: deleted as unknown as Record<string, unknown>,
        });
      }

      return deleted;
    }),

  createPendingPSV: protectedProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        status: z.enum(["Not Started", "Requested", "Received", "Inactive Rad", "Closed", "Not Affiliated", "Old Request", "Hold"]),
        type: z.enum(["Education", "Work", "Hospital", "Peer", "COI/Loss Run", "Claims Document", "Board Actions", "Locums/Work", "Vesta Practice Location", "Vesta Hospital", "Work COI", "OPPE"]),
        name: z.string().min(1),
        dateRequested: z.string().date(),
        nextFollowUp: z.string().date().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const parsedUserId = z.string().uuid().safeParse(ctx.user.id);
      const [currentAgent] = parsedUserId.success
        ? await ctx.db.select({ id: agents.id }).from(agents).where(eq(agents.userId, parsedUserId.data)).limit(1)
        : [];

      if (!currentAgent) {
        throw new Error("No linked agent found for current user.");
      }

      const result = await ctx.db
        .insert(pendingPSV)
        .values({
          providerId: input.providerId,
          agentAssigned: currentAgent.id,
          status: input.status,
          type: input.type,
          name: input.name,
          dateRequested: input.dateRequested,
          nextFollowUp: input.nextFollowUp ?? null,
          notes: input.notes ?? null,
          updatedAt: new Date(),
        })
        .returning();

      const [created] = result;
      if (!created) throw new Error("Failed to create pending PSV.");

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "pending_psv",
        recordId: created.id,
        action: "create",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        newData: created as unknown as Record<string, unknown>,
      });

      return created;
    }),

  updatePendingPSV: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["Not Started", "Requested", "Received", "Inactive Rad", "Closed", "Not Affiliated", "Old Request", "Hold"]),
        type: z.enum(["Education", "Work", "Hospital", "Peer", "COI/Loss Run", "Claims Document", "Board Actions", "Locums/Work", "Vesta Practice Location", "Vesta Hospital", "Work COI", "OPPE"]),
        name: z.string().min(1),
        dateRequested: z.string().date(),
        nextFollowUp: z.string().date().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(pendingPSV)
        .where(eq(pendingPSV.id, input.id))
        .limit(1);

      const result = await ctx.db
        .update(pendingPSV)
        .set({
          status: input.status,
          type: input.type,
          name: input.name,
          dateRequested: input.dateRequested,
          nextFollowUp: input.nextFollowUp ?? null,
          notes: input.notes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(pendingPSV.id, input.id))
        .returning();

      const [updated] = result;
      if (!updated) throw new Error("Pending PSV not found.");

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "pending_psv",
        recordId: input.id,
        action: "update",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        oldData: existing as unknown as Record<string, unknown>,
        newData: updated as unknown as Record<string, unknown>,
      });

      return updated;
    }),

  deletePendingPSV: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .delete(pendingPSV)
        .where(eq(pendingPSV.id, input.id))
        .returning();

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      const deleted = result[0] ?? null;
      if (deleted) {
        await writeAuditLog(ctx.db, {
          tableName: "pending_psv",
          recordId: deleted.id,
          action: "delete",
          actorId: actor?.id ?? null,
          actorEmail: actor?.email ?? ctx.user.email ?? null,
          oldData: deleted as unknown as Record<string, unknown>,
        });
      }

      return deleted;
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
        .where(
          and(
            eq(missingDocs.relatedId, input.relatedId),
            eq(missingDocs.relatedType, input.relatedType),
            eq(missingDocs.followUpStatus, "Not Completed"),
          ),
        );

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

      const [existing] = await ctx.db
        .select()
        .from(commLogs)
        .where(eq(commLogs.id, input.id))
        .limit(1);

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

      const [updated] = result;
      if (!updated) throw new Error("Comm log not found.");

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "comm_logs",
        recordId: input.id,
        action: "update",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        oldData: existing
          ? ({ ...existing, subject: null, notes: null } as unknown as Record<string, unknown>)
          : undefined,
        newData: { ...updated, subject: null, notes: null } as unknown as Record<string, unknown>,
      });

      return updated;
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
      const normalizedSearch = input.search?.trim();
      const providerSearchCondition = normalizedSearch
        ? or(
            ilike(providers.firstName, `%${normalizedSearch}%`),
            ilike(providers.lastName, `%${normalizedSearch}%`),
            ilike(providers.email, `%${normalizedSearch}%`),
            ilike(providers.degree, `%${normalizedSearch}%`),
          )
        : undefined;

      const hasMissingDocsCondition = exists(
        ctx.db
          .select({ id: missingDocs.id })
          .from(missingDocs)
          .where(
            and(
              eq(missingDocs.relatedType, "provider"),
              eq(missingDocs.relatedId, providers.id),
              eq(missingDocs.followUpStatus, "Not Completed"),
            ),
          ),
      );

      const hasPendingPsvCondition = exists(
        ctx.db
          .select({ id: pendingPSV.id })
          .from(pendingPSV)
          .where(
            and(
              eq(pendingPSV.providerId, providers.id),
              ne(pendingPSV.status, "Closed"),
            ),
          ),
      );

      const providerFilterCondition =
        input.filter === "psv"
          ? hasPendingPsvCondition
          : input.filter === "missing"
            ? hasMissingDocsCondition
            : undefined;

      const providerWhere =
        providerSearchCondition && providerFilterCondition
          ? and(providerSearchCondition, providerFilterCondition)
          : providerSearchCondition ?? providerFilterCondition;

      const providerRows = await ctx.db
        .select({
          degree: providers.degree,
          email: providers.email,
          firstName: providers.firstName,
          id: providers.id,
          lastName: providers.lastName,
        })
        .from(providers)
        .where(providerWhere);

      const providerIds = providerRows.map((provider) => provider.id);

      if (providerIds.length === 0) {
        return [];
      }

      const [missingDocRows, pendingPsvRows, providerLogRows, providerPrivilegeRows] =
        await Promise.all([
          ctx.db
            .select({
              createdAt: missingDocs.createdAt,
              nextFollowUpIn: missingDocs.nextFollowUpIn,
              nextFollowUpUS: missingDocs.nextFollowUpUS,
              relatedId: missingDocs.relatedId,
              updatedAt: missingDocs.updatedAt,
            })
            .from(missingDocs)
            .where(
              and(
                eq(missingDocs.relatedType, "provider"),
                eq(missingDocs.followUpStatus, "Not Completed"),
                inArray(missingDocs.relatedId, providerIds),
              ),
            ),
          ctx.db
            .select({
              createdAt: pendingPSV.createdAt,
              nextFollowUp: pendingPSV.nextFollowUp,
              providerId: pendingPSV.providerId,
              status: pendingPSV.status,
              updatedAt: pendingPSV.updatedAt,
            })
            .from(pendingPSV)
            .where(and(inArray(pendingPSV.providerId, providerIds), ne(pendingPSV.status, "Closed")))
            .orderBy(desc(pendingPSV.updatedAt), desc(pendingPSV.createdAt)),
          ctx.db
            .select({
              lastUpdatedAt: max(commLogs.updatedAt),
              relatedId: commLogs.relatedId,
            })
            .from(commLogs)
            .where(and(eq(commLogs.relatedType, "provider"), inArray(commLogs.relatedId, providerIds)))
            .groupBy(commLogs.relatedId),
          ctx.db
            .select({
              createdAt: providerVestaPrivileges.createdAt,
              privilegeTier: providerVestaPrivileges.privilegeTier,
              providerId: providerVestaPrivileges.providerId,
              updatedAt: providerVestaPrivileges.updatedAt,
            })
            .from(providerVestaPrivileges)
            .where(inArray(providerVestaPrivileges.providerId, providerIds))
            .orderBy(
              desc(providerVestaPrivileges.updatedAt),
              desc(providerVestaPrivileges.createdAt),
            ),
        ]);

      const missingDocsByProvider = new Map<string, string | null>();
      const latestMissingDocActivityByProvider = new Map<string, Date>();
      for (const row of missingDocRows) {
        if (!row.relatedId) continue;
        const current = missingDocsByProvider.get(row.relatedId);
        const nextFollowUp = getEarliestFollowUp(
          row.nextFollowUpUS,
          row.nextFollowUpIn,
        );

        if (!current || (nextFollowUp && nextFollowUp < current)) {
          missingDocsByProvider.set(row.relatedId, nextFollowUp);
        }

        const latestDocActivity = getLatestActivityDate(row.updatedAt, row.createdAt);
        const existingLatestDocActivity = latestMissingDocActivityByProvider.get(row.relatedId);

        if (
          latestDocActivity &&
          (!existingLatestDocActivity ||
            latestDocActivity.getTime() > existingLatestDocActivity.getTime())
        ) {
          latestMissingDocActivityByProvider.set(row.relatedId, latestDocActivity);
        }
      }

      const psvByProvider = new Map<
        string,
        { status: string; nextFollowUp: string | null; latestActivity: Date | null }
      >();
      for (const row of pendingPsvRows) {
        if (!row.providerId || row.status === "Closed") continue;
        const rowLatestActivity = getLatestActivityDate(row.updatedAt, row.createdAt);
        const existing = psvByProvider.get(row.providerId);
        if (!existing) {
          psvByProvider.set(row.providerId, {
            status: row.status,
            nextFollowUp: row.nextFollowUp,
            latestActivity: rowLatestActivity,
          });
          continue;
        }

        if (!existing.nextFollowUp || (row.nextFollowUp && row.nextFollowUp < existing.nextFollowUp)) {
          existing.nextFollowUp = row.nextFollowUp;
        }

        if (
          rowLatestActivity &&
          (!existing.latestActivity || rowLatestActivity.getTime() > existing.latestActivity.getTime())
        ) {
          existing.latestActivity = rowLatestActivity;
        }
      }

      const latestCommLogActivityByProvider = new Map<string, Date>();
      for (const row of providerLogRows) {
        if (!row.relatedId || !row.lastUpdatedAt) continue;
        const latestLogActivity = getLatestActivityDate(row.lastUpdatedAt);
        const existingLatestLogActivity = latestCommLogActivityByProvider.get(row.relatedId);
        if (
          latestLogActivity &&
          (!existingLatestLogActivity ||
            latestLogActivity.getTime() > existingLatestLogActivity.getTime())
        ) {
          latestCommLogActivityByProvider.set(row.relatedId, latestLogActivity);
        }
      }

      const privilegeTierByProvider = new Map<string, string | null>();
      for (const row of providerPrivilegeRows) {
        if (!row.providerId || privilegeTierByProvider.has(row.providerId)) continue;
        privilegeTierByProvider.set(row.providerId, row.privilegeTier);
      }

      let filteredRows = providerRows.map((provider) => {
        const missingFollowUp = missingDocsByProvider.get(provider.id);
        const psv = psvByProvider.get(provider.id);
        const hasMissingDocs = missingDocsByProvider.has(provider.id);
        const hasPSV = Boolean(psv);

        const nextFollowupAt =
          missingFollowUp && psv?.nextFollowUp
            ? missingFollowUp < psv.nextFollowUp
              ? missingFollowUp
              : psv.nextFollowUp
            : missingFollowUp ?? psv?.nextFollowUp ?? null;

        const latestStatus = hasMissingDocs
          ? "Missing Docs"
          : hasPSV
            ? `PSV: ${psv?.status ?? ""}`
            : null;

        const lastUpdatedAt = getLatestActivityDate(
          latestCommLogActivityByProvider.get(provider.id),
          psv?.latestActivity,
          latestMissingDocActivityByProvider.get(provider.id),
        );

        return {
          ...provider,
          hasMissingDocs,
          hasPSV,
          privilegeTier: privilegeTierByProvider.get(provider.id) ?? null,
          latestStatus,
          nextFollowupAt,
          lastUpdatedAt,
        };
      });

      if (input.filter === "psv") {
        filteredRows = filteredRows.filter((row) => row.hasPSV);
      } else if (input.filter === "missing") {
        filteredRows = filteredRows.filter((row) => row.hasMissingDocs);
      }

      if (input.search) {
        const q = input.search.toLowerCase();
        filteredRows = filteredRows.filter((provider) =>
          `${provider.firstName ?? ""} ${provider.lastName ?? ""}`.toLowerCase().includes(q),
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
      const normalizedSearch = input.search?.trim();
      const facilitySearchCondition = normalizedSearch
        ? or(
            ilike(facilities.name, `%${normalizedSearch}%`),
            ilike(facilities.state, `%${normalizedSearch}%`),
          )
        : undefined;

      const hasMissingDocsCondition = exists(
        ctx.db
          .select({ id: missingDocs.id })
          .from(missingDocs)
          .where(
            and(
              eq(missingDocs.relatedType, "facility"),
              eq(missingDocs.relatedId, facilities.id),
              eq(missingDocs.followUpStatus, "Not Completed"),
            ),
          ),
      );

      const facilityWhere =
        input.filter === "missing"
          ? facilitySearchCondition
            ? and(facilitySearchCondition, hasMissingDocsCondition)
            : hasMissingDocsCondition
          : facilitySearchCondition;

      const facilityRows = await ctx.db
        .select({
          id: facilities.id,
          name: facilities.name,
          state: facilities.state,
          status: facilities.status,
        })
        .from(facilities)
        .where(facilityWhere);

      const facilityIds = facilityRows.map((facility) => facility.id);

      if (facilityIds.length === 0) {
        return [];
      }

      const [missingDocRows, facilityLogRows] = await Promise.all([
        ctx.db
          .select({
            createdAt: missingDocs.createdAt,
            nextFollowUpIn: missingDocs.nextFollowUpIn,
            nextFollowUpUS: missingDocs.nextFollowUpUS,
            relatedId: missingDocs.relatedId,
            updatedAt: missingDocs.updatedAt,
          })
          .from(missingDocs)
          .where(
            and(
              eq(missingDocs.relatedType, "facility"),
              eq(missingDocs.followUpStatus, "Not Completed"),
              inArray(missingDocs.relatedId, facilityIds),
            ),
          ),
        ctx.db
          .select({
            lastUpdatedAt: max(commLogs.updatedAt),
            relatedId: commLogs.relatedId,
          })
          .from(commLogs)
          .where(and(eq(commLogs.relatedType, "facility"), inArray(commLogs.relatedId, facilityIds)))
          .groupBy(commLogs.relatedId),
      ]);

      const missingDocsByFacility = new Map<string, string | null>();
      const latestMissingDocActivityByFacility = new Map<string, Date>();
      for (const row of missingDocRows) {
        if (!row.relatedId) continue;
        const current = missingDocsByFacility.get(row.relatedId);
        const nextFollowUp = getEarliestFollowUp(
          row.nextFollowUpUS,
          row.nextFollowUpIn,
        );

        if (!current || (nextFollowUp && nextFollowUp < current)) {
          missingDocsByFacility.set(row.relatedId, nextFollowUp);
        }

        const latestDocActivity = getLatestActivityDate(row.updatedAt, row.createdAt);
        const existingLatestDocActivity = latestMissingDocActivityByFacility.get(row.relatedId);
        if (
          latestDocActivity &&
          (!existingLatestDocActivity ||
            latestDocActivity.getTime() > existingLatestDocActivity.getTime())
        ) {
          latestMissingDocActivityByFacility.set(row.relatedId, latestDocActivity);
        }
      }

      const latestCommLogActivityByFacility = new Map<string, Date>();
      for (const row of facilityLogRows) {
        if (!row.relatedId || !row.lastUpdatedAt) continue;
        const latestLogActivity = getLatestActivityDate(row.lastUpdatedAt);
        const existingLatestLogActivity = latestCommLogActivityByFacility.get(row.relatedId);
        if (
          latestLogActivity &&
          (!existingLatestLogActivity ||
            latestLogActivity.getTime() > existingLatestLogActivity.getTime())
        ) {
          latestCommLogActivityByFacility.set(row.relatedId, latestLogActivity);
        }
      }

      const filteredRows = facilityRows.map((facility) => {
        const hasMissingDocs = missingDocsByFacility.has(facility.id);

        return {
          ...facility,
          hasMissingDocs,
          latestStatus: hasMissingDocs ? "Missing Docs" : "General",
          nextFollowupAt: missingDocsByFacility.get(facility.id) ?? null,
          lastUpdatedAt: getLatestActivityDate(
            latestCommLogActivityByFacility.get(facility.id),
            latestMissingDocActivityByFacility.get(facility.id),
          ),
        };
      });

      return filteredRows;
    }),
});

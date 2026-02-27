import { z } from "zod";
import { eq, desc, count, and, inArray } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
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

  createMissingDoc: protectedProcedure
    .input(
      z.object({
        relatedType: z.enum(["provider", "facility"]),
        relatedId: z.string().uuid(),
        information: z.string().min(1),
        roadblocks: z.string().optional(),
        nextFollowUp: z.string().optional(),
        nextFollowUpUS: z.string().optional(),
        nextFollowUpIn: z.string().optional(),
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

      return result[0];
    }),

  updateMissingDoc: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        information: z.string().min(1),
        roadblocks: z.string().optional(),
        nextFollowUp: z.string().optional(),
        nextFollowUpUS: z.string().optional(),
        nextFollowUpIn: z.string().optional(),
        followUpStatus: z.enum(["Completed", "Pending Response", "Not Completed"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nextFollowUpUS = input.nextFollowUpUS ?? input.nextFollowUp ?? null;
      const nextFollowUpIn = input.nextFollowUpIn ?? input.nextFollowUp ?? null;

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

      return result[0];
    }),

  deleteMissingDoc: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .delete(missingDocs)
        .where(eq(missingDocs.id, input.id))
        .returning({ id: missingDocs.id });

      return result[0] ?? null;
    }),

  createPendingPSV: protectedProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        status: z.enum(["Not Started", "Requested", "Received", "Inactive Rad", "Closed", "Not Affiliated", "Old Request", "Hold"]),
        type: z.enum(["Education", "Work", "Hospital", "Peer", "COI/Loss Run", "Claims Document", "Board Actions", "Locums/Work", "Vesta Practice Location", "Vesta Hospital", "Work COI", "OPPE"]),
        name: z.string().min(1),
        dateRequested: z.string(),
        nextFollowUp: z.string().optional(),
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

      return result[0];
    }),

  updatePendingPSV: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["Not Started", "Requested", "Received", "Inactive Rad", "Closed", "Not Affiliated", "Old Request", "Hold"]),
        type: z.enum(["Education", "Work", "Hospital", "Peer", "COI/Loss Run", "Claims Document", "Board Actions", "Locums/Work", "Vesta Practice Location", "Vesta Hospital", "Work COI", "OPPE"]),
        name: z.string().min(1),
        dateRequested: z.string(),
        nextFollowUp: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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

      return result[0];
    }),

  deletePendingPSV: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .delete(pendingPSV)
        .where(eq(pendingPSV.id, input.id))
        .returning({ id: pendingPSV.id });

      return result[0] ?? null;
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
      const [providerRows, missingDocRows, pendingPsvRows, providerLogRows, providerPrivilegeRows] = await Promise.all([
        ctx.db.select({
          id: providers.id,
          firstName: providers.firstName,
          lastName: providers.lastName,
          degree: providers.degree,
          email: providers.email,
        }).from(providers),
        ctx.db
          .select({
            relatedId: missingDocs.relatedId,
            nextFollowUpUS: missingDocs.nextFollowUpUS,
            nextFollowUpIn: missingDocs.nextFollowUpIn,
            followUpStatus: missingDocs.followUpStatus,
            createdAt: missingDocs.createdAt,
            updatedAt: missingDocs.updatedAt,
          })
          .from(missingDocs)
          .where(eq(missingDocs.relatedType, "provider")),
        ctx.db
          .select({
            providerId: pendingPSV.providerId,
            status: pendingPSV.status,
            nextFollowUp: pendingPSV.nextFollowUp,
            createdAt: pendingPSV.createdAt,
            updatedAt: pendingPSV.updatedAt,
          })
          .from(pendingPSV)
          .orderBy(desc(pendingPSV.updatedAt), desc(pendingPSV.createdAt)),
        ctx.db
          .select({
            relatedId: commLogs.relatedId,
            subject: commLogs.subject,
            createdAt: commLogs.createdAt,
            updatedAt: commLogs.updatedAt,
          })
          .from(commLogs)
          .where(eq(commLogs.relatedType, "provider"))
          .orderBy(desc(commLogs.createdAt)),
        ctx.db
          .select({
            providerId: providerVestaPrivileges.providerId,
            privilegeTier: providerVestaPrivileges.privilegeTier,
            updatedAt: providerVestaPrivileges.updatedAt,
            createdAt: providerVestaPrivileges.createdAt,
          })
          .from(providerVestaPrivileges)
          .orderBy(
            desc(providerVestaPrivileges.updatedAt),
            desc(providerVestaPrivileges.createdAt),
          ),
      ]);

      const missingDocsByProvider = new Map<string, string | null>();
      const latestMissingDocActivityByProvider = new Map<string, Date>();
      for (const row of missingDocRows) {
        if (!row.relatedId || row.followUpStatus !== "Not Completed") continue;
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
        if (row.status === "Closed") continue;
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

      const latestSubjectByProvider = new Map<string, string | null>();
      const latestCommLogActivityByProvider = new Map<string, Date>();
      for (const row of providerLogRows) {
        if (!row.relatedId || latestSubjectByProvider.has(row.relatedId)) continue;
        latestSubjectByProvider.set(row.relatedId, row.subject);

        const latestLogActivity = getLatestActivityDate(row.updatedAt, row.createdAt);
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
            : latestSubjectByProvider.get(provider.id) ?? null;

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
      const [facilityRows, missingDocRows, facilityLogRows] = await Promise.all([
        ctx.db
          .select({
            id: facilities.id,
            name: facilities.name,
            state: facilities.state,
            status: facilities.status,
          })
          .from(facilities),
        ctx.db
          .select({
            relatedId: missingDocs.relatedId,
            nextFollowUpUS: missingDocs.nextFollowUpUS,
            nextFollowUpIn: missingDocs.nextFollowUpIn,
            followUpStatus: missingDocs.followUpStatus,
            createdAt: missingDocs.createdAt,
            updatedAt: missingDocs.updatedAt,
          })
          .from(missingDocs)
          .where(eq(missingDocs.relatedType, "facility")),
        ctx.db
          .select({
            relatedId: commLogs.relatedId,
            createdAt: commLogs.createdAt,
            updatedAt: commLogs.updatedAt,
          })
          .from(commLogs)
          .where(eq(commLogs.relatedType, "facility"))
          .orderBy(desc(commLogs.createdAt)),
      ]);

      const missingDocsByFacility = new Map<string, string | null>();
      const latestMissingDocActivityByFacility = new Map<string, Date>();
      for (const row of missingDocRows) {
        if (!row.relatedId || row.followUpStatus !== "Not Completed") continue;
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
        if (!row.relatedId) continue;
        const latestLogActivity = getLatestActivityDate(row.updatedAt, row.createdAt);
        const existingLatestLogActivity = latestCommLogActivityByFacility.get(row.relatedId);
        if (
          latestLogActivity &&
          (!existingLatestLogActivity ||
            latestLogActivity.getTime() > existingLatestLogActivity.getTime())
        ) {
          latestCommLogActivityByFacility.set(row.relatedId, latestLogActivity);
        }
      }

      let filteredRows = facilityRows.map((facility) => {
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

      if (input.filter === "missing") {
        filteredRows = filteredRows.filter((facility) => facility.hasMissingDocs);
      }

      if (input.search) {
        const q = input.search.toLowerCase();
        filteredRows = filteredRows.filter(
          (facility) => {
            const matchesName = facility.name?.toLowerCase().includes(q) ?? false;
            const matchesState = facility.state?.toLowerCase().includes(q) ?? false;
            return matchesName || matchesState;
          },
        );
      }

      return filteredRows;
    }),
});

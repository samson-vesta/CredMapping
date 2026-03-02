import { z } from "zod";
import { and, asc, desc, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { resolveAgentId, writeAuditLog } from "~/server/api/audit";
import {
  agents,
  facilities,
  incidentLogs,
  providerFacilityCredentials,
  providers,
  providerStateLicenses,
  providerVestaPrivileges,
  workflowPhases,
} from "~/server/db/schema";

const toNull = (v: string | undefined | null) =>
  v === undefined || v === null || v.trim() === "" ? null : v.trim();

// ────────────────────────────────────────────────────────────────
// Workflows Router
// ────────────────────────────────────────────────────────────────

export const workflowsRouter = createTRPCRouter({
  /** List workflow phases with filters – the backbone of the /workflows page */
  list: protectedProcedure
    .input(
      z.object({
        workflowType: z
          .enum(["pfc", "state_licenses", "prelive_pipeline", "provider_vesta_privileges", "all"])
          .default("all"),
        status: z.string().optional(),
        assignedToMe: z.boolean().default(false),
        assignedToAgent: z.string().uuid().optional(),
        hasIncidents: z.boolean().default(false),
        search: z.string().optional(),
        limit: z.number().default(60),
        offset: z.number().default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.workflowType !== "all") {
        conditions.push(eq(workflowPhases.workflowType, input.workflowType));
      }
      if (input.status && input.status !== "all") {
        conditions.push(eq(workflowPhases.status, input.status));
      }

      // "Assigned to me" – find workflow groups that have at least one phase
      // assigned to (or supporting) the current user, then return ALL phases
      // for those groups so the grouped UI shows the complete workflow.
      if (input.assignedToMe && ctx.user) {
        const actor = await resolveAgentId(ctx.db, ctx.user.id);
        if (actor) {
          // Sub-select: relatedIds where the user is assigned or supporting
          const myRelated = ctx.db
            .selectDistinct({ relatedId: workflowPhases.relatedId })
            .from(workflowPhases)
            .where(
              or(
                eq(workflowPhases.agentAssigned, actor.id),
                sql`${workflowPhases.supportingAgents}::jsonb @> ${JSON.stringify([actor.id])}::jsonb`,
              ),
            );
          conditions.push(inArray(workflowPhases.relatedId, myRelated));
        } else {
          // User has no agent record — return nothing
          return [];
        }
      }

      // Filter by a specific agent (not just "me")
      if (input.assignedToAgent) {
        const agentId = input.assignedToAgent;
        const agentRelated = ctx.db
          .selectDistinct({ relatedId: workflowPhases.relatedId })
          .from(workflowPhases)
          .where(
            or(
              eq(workflowPhases.agentAssigned, agentId),
              sql`${workflowPhases.supportingAgents}::jsonb @> ${JSON.stringify([agentId])}::jsonb`,
            ),
          );
        conditions.push(inArray(workflowPhases.relatedId, agentRelated));
      }

      // Filter to only workflow phases that have at least one incident log
      if (input.hasIncidents) {
        conditions.push(
          exists(
            ctx.db
              .select({ one: sql`1` })
              .from(incidentLogs)
              .where(eq(incidentLogs.workflowID, workflowPhases.id)),
          ),
        );
      }

      if (input.search) {
        conditions.push(ilike(workflowPhases.phaseName, `%${input.search}%`));
      }

      const rows = await ctx.db
        .select({
          id: workflowPhases.id,
          workflowType: workflowPhases.workflowType,
          relatedId: workflowPhases.relatedId,
          phaseName: workflowPhases.phaseName,
          status: workflowPhases.status,
          startDate: workflowPhases.startDate,
          dueDate: workflowPhases.dueDate,
          completedAt: workflowPhases.completedAt,
          notes: workflowPhases.notes,
          createdAt: workflowPhases.createdAt,
          updatedAt: workflowPhases.updatedAt,
          agentAssigned: workflowPhases.agentAssigned,
          supportingAgents: workflowPhases.supportingAgents,
          assignedFirstName: agents.firstName,
          assignedLastName: agents.lastName,
          incidentCount: sql<number>`(
            SELECT count(*)::int FROM ${incidentLogs}
            WHERE ${incidentLogs.workflowID} = ${workflowPhases.id}
          )`.as("incident_count"),
        })
        .from(workflowPhases)
        .leftJoin(agents, eq(workflowPhases.agentAssigned, agents.id))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(workflowPhases.updatedAt))
        .limit(input.limit)
        .offset(input.offset);

      // Enrich with context names for the related entity
      const pfcIds = rows
        .filter((r) => r.workflowType === "pfc")
        .map((r) => r.relatedId);
      const licenseIds = rows
        .filter((r) => r.workflowType === "state_licenses")
        .map((r) => r.relatedId);
      const privIds = rows
        .filter((r) => r.workflowType === "provider_vesta_privileges")
        .map((r) => r.relatedId);

      type PfcContext = {
        id: string;
        providerFirstName: string | null;
        providerLastName: string | null;
        providerDegree: string | null;
        facilityName: string | null;
      };

      let pfcMap = new Map<string, PfcContext>();
      if (pfcIds.length > 0) {
        const pfcRows = await ctx.db
          .select({
            id: providerFacilityCredentials.id,
            providerFirstName: providers.firstName,
            providerLastName: providers.lastName,
            providerDegree: providers.degree,
            facilityName: facilities.name,
          })
          .from(providerFacilityCredentials)
          .leftJoin(providers, eq(providerFacilityCredentials.providerId, providers.id))
          .leftJoin(facilities, eq(providerFacilityCredentials.facilityId, facilities.id))
          .where(inArray(providerFacilityCredentials.id, pfcIds));
        pfcMap = new Map(pfcRows.map((r) => [r.id, r]));
      }

      // State licenses context: provider name + state
      let licenseMap = new Map<string, { provName: string; state: string | null }>();
      if (licenseIds.length > 0) {
        const licRows = await ctx.db
          .select({
            id: providerStateLicenses.id,
            state: providerStateLicenses.state,
            provFirstName: providers.firstName,
            provLastName: providers.lastName,
          })
          .from(providerStateLicenses)
          .leftJoin(providers, eq(providerStateLicenses.providerId, providers.id))
          .where(inArray(providerStateLicenses.id, licenseIds));
        licenseMap = new Map(
          licRows.map((r) => [
            r.id,
            {
              provName: [r.provFirstName, r.provLastName].filter(Boolean).join(" ") || "Unknown Provider",
              state: r.state,
            },
          ]),
        );
      }

      // Vesta privileges context: provider name
      let privMap = new Map<string, string>();
      if (privIds.length > 0) {
        const privRows = await ctx.db
          .select({
            id: providerVestaPrivileges.id,
            provFirstName: providers.firstName,
            provLastName: providers.lastName,
          })
          .from(providerVestaPrivileges)
          .leftJoin(providers, eq(providerVestaPrivileges.providerId, providers.id))
          .where(inArray(providerVestaPrivileges.id, privIds));
        privMap = new Map(
          privRows.map((r) => [
            r.id,
            [r.provFirstName, r.provLastName].filter(Boolean).join(" ") || "Unknown Provider",
          ]),
        );
      }

      return rows.map((row) => {
        const pfc = pfcMap.get(row.relatedId);
        const assignedName =
          row.assignedFirstName || row.assignedLastName
            ? `${row.assignedFirstName ?? ""} ${row.assignedLastName ?? ""}`.trim()
            : null;

        let contextLabel = "";
        if (row.workflowType === "pfc" && pfc) {
          const provName = [pfc.providerFirstName, pfc.providerLastName]
            .filter(Boolean)
            .join(" ");
          contextLabel = `${provName ?? "Unknown Provider"} → ${pfc.facilityName ?? "Unknown Facility"}`;        } else if (row.workflowType === "state_licenses") {
          const lic = licenseMap.get(row.relatedId);
          if (lic) contextLabel = lic.state ? `${lic.provName} \u2013 ${lic.state}` : lic.provName;
        } else if (row.workflowType === "provider_vesta_privileges") {
          contextLabel = privMap.get(row.relatedId) ?? "";        }

        return {
          ...row,
          assignedName,
          contextLabel,
          supportingAgentIds: (row.supportingAgents as string[] | null) ?? [],
        };
      });
    }),

  /** Get a single workflow phase with full details */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          id: workflowPhases.id,
          workflowType: workflowPhases.workflowType,
          relatedId: workflowPhases.relatedId,
          phaseName: workflowPhases.phaseName,
          status: workflowPhases.status,
          startDate: workflowPhases.startDate,
          dueDate: workflowPhases.dueDate,
          completedAt: workflowPhases.completedAt,
          notes: workflowPhases.notes,
          createdAt: workflowPhases.createdAt,
          updatedAt: workflowPhases.updatedAt,
          agentAssigned: workflowPhases.agentAssigned,
          supportingAgents: workflowPhases.supportingAgents,
          assignedFirstName: agents.firstName,
          assignedLastName: agents.lastName,
        })
        .from(workflowPhases)
        .leftJoin(agents, eq(workflowPhases.agentAssigned, agents.id))
        .where(eq(workflowPhases.id, input.id))
        .limit(1);

      if (!row) throw new Error("Workflow phase not found.");
      return row;
    }),

  // Fetch providers for create workflow dropdown
  listProvidersForDropdown: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ id: providers.id, firstName: providers.firstName, lastName: providers.lastName })
      .from(providers)
      .orderBy(asc(providers.firstName));
    return rows.map((r) => ({
      id: r.id,
      name: [r.firstName, r.lastName].filter(Boolean).join(" ") || "Unknown Provider",
    }));
  }),

  // Fetch facilities for create workflow dropdown
  listFacilitiesForDropdown: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db
      .select({ id: facilities.id, name: facilities.name })
      .from(facilities)
      .orderBy(asc(facilities.name));
  }),

  /** Create a new workflow phase.
   * Writes audit log automatically. */
  create: protectedProcedure
    .input(
      z.object({
        // --- REQUIRED IDENTIFIERS ---
        workflowType: z.enum(["pfc", "state_licenses", "prelive_pipeline", "provider_vesta_privileges"]),
        providerId: z.string().uuid(),
        facilityId: z.string().uuid(),

        // --- BULK PHASES ---
        // Instead of individual fields, we accept an array of phase objects
        phases: z.array(
          z.object({
            phaseName: z.string().trim().min(1),
            startDate: z.string().date().optional(),
            dueDate: z.string().date().optional(),
            status: z.string().trim().optional().default("Pending"),
            completedAt: z.string().date().optional(),
            workflowNotes: z.string().optional(),
            agentAssigned: z.string().uuid().optional(),
          })
        ).min(1, "At least one phase is required"),

        // --- PFC RELATIONSHIP OPTIONAL FIELDS ---
        facilityType: z.string().optional(),
        privileges: z.string().optional(),
        priority: z.string().optional(),
        applicationRequired: z.boolean().optional(),
        pfcNotes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      if (!actor) throw new Error("Agent record not found.");

      // Existing PFC Check
      const [existingPfc] = await ctx.db
        .select()
        .from(providerFacilityCredentials)
        .where(
          and(
            eq(providerFacilityCredentials.providerId, input.providerId),
            eq(providerFacilityCredentials.facilityId, input.facilityId)
          )
        )
        .limit(1);

      if (existingPfc) throw new Error("This provider is already connected to this facility.");

      // Create the Relationship (PFC only right now)
      const [newPfc] = await ctx.db
        .insert(providerFacilityCredentials)
        .values({
          providerId: input.providerId,
          facilityId: input.facilityId,
          facilityType: input.facilityType,
          privileges: input.privileges,
          priority: input.priority,
          applicationRequired: input.applicationRequired,
          notes: input.pfcNotes,
        })
        .returning();

      await writeAuditLog(ctx.db, {
        tableName: "provider_facility_credentials",
        recordId: newPfc!.id,
        action: "create",
        actorId: actor.id,
        actorEmail: actor.email,
        newData: newPfc as unknown as Record<string, unknown>,
      });
      
      const phaseRecords = input.phases.map((phase) => ({
        workflowType: input.workflowType,
        relatedId: newPfc!.id,
        phaseName: phase.phaseName,
        startDate: phase.startDate,
        dueDate: phase.dueDate,
        status: phase.status,
        completedAt: phase.completedAt,
        notes: phase.workflowNotes,
        agentAssigned: phase.agentAssigned ?? null,
        supportingAgents: [],
      }));

      const createdPhases = await ctx.db
        .insert(workflowPhases)
        .values(phaseRecords)
        .returning();

      // Audit Log for each phase
      for (const phase of createdPhases) {
        await writeAuditLog(ctx.db, {
          tableName: "workflow_phases",
          recordId: phase.id,
          action: "create",
          actorId: actor.id,
          actorEmail: actor.email,
          newData: phase as unknown as Record<string, unknown>,
        });
      }

      return { pfc: newPfc, phases: createdPhases };
    }),

  /** Update a workflow phase — the core operation.
   *  Writes audit log + manages supportingAgents automatically. */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        phaseName: z.string().trim().min(1).optional(),
        status: z.string().trim().optional(),
        startDate: z.string().optional(),
        dueDate: z.string().optional(),
        completedAt: z.string().optional(),
        notes: z.string().optional(),
        agentAssigned: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Capture old state
      const [existing] = await ctx.db
        .select()
        .from(workflowPhases)
        .where(eq(workflowPhases.id, input.id))
        .limit(1);

      if (!existing) throw new Error("Workflow phase not found.");

      const actor = await resolveAgentId(ctx.db, ctx.user.id);

      // Build set object — only include provided fields
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (input.phaseName !== undefined) set.phaseName = input.phaseName;
      if (input.status !== undefined) set.status = input.status;
      if (input.startDate !== undefined) set.startDate = input.startDate;
      if (input.dueDate !== undefined) set.dueDate = toNull(input.dueDate);
      if (input.completedAt !== undefined) set.completedAt = toNull(input.completedAt);
      if (input.notes !== undefined) set.notes = toNull(input.notes);
      if (input.agentAssigned !== undefined) set.agentAssigned = input.agentAssigned;

      // Auto-add actor to supportingAgents if they're not the assigned agent
      let supportingAgents = (existing.supportingAgents as string[] | null) ?? [];
      if (actor) {
        const assignedAgentId: string | null = input.agentAssigned !== undefined
          ? input.agentAssigned
          : existing.agentAssigned;

        if (assignedAgentId !== actor.id && !supportingAgents.includes(actor.id)) {
          supportingAgents = [...supportingAgents, actor.id];
          set.supportingAgents = supportingAgents;
        }
      }

      const [updated] = await ctx.db
        .update(workflowPhases)
        .set(set)
        .where(eq(workflowPhases.id, input.id))
        .returning();

      // Audit log
      await writeAuditLog(ctx.db, {
        tableName: "workflow_phases",
        recordId: input.id,
        action: "update",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        oldData: existing as unknown as Record<string, unknown>,
        newData: updated as unknown as Record<string, unknown>,
      });

      return updated;
    }),

  /** Self-assign: let an agent claim an unassigned workflow phase */
  selfAssign: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(workflowPhases)
        .where(eq(workflowPhases.id, input.id))
        .limit(1);

      if (!existing) throw new Error("Workflow phase not found.");
      if (existing.agentAssigned) throw new Error("This workflow is already assigned to someone.");

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      if (!actor) throw new Error("Agent record not found for current user.");

      const [updated] = await ctx.db
        .update(workflowPhases)
        .set({ agentAssigned: actor.id, updatedAt: new Date() })
        .where(eq(workflowPhases.id, input.id))
        .returning();

      await writeAuditLog(ctx.db, {
        tableName: "workflow_phases",
        recordId: input.id,
        action: "update",
        actorId: actor.id,
        actorEmail: actor.email,
        oldData: existing as unknown as Record<string, unknown>,
        newData: updated as unknown as Record<string, unknown>,
      });

      return updated;
    }),

  /** Get distinct status values currently in the table — for filter suggestions */
  distinctStatuses: protectedProcedure
    .input(
      z.object({
        workflowType: z
          .enum(["pfc", "state_licenses", "prelive_pipeline", "provider_vesta_privileges", "all"])
          .default("all"),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const wt = input?.workflowType ?? "all";
      const rows = await ctx.db
        .selectDistinct({ status: workflowPhases.status })
        .from(workflowPhases)
        .where(wt !== "all" ? eq(workflowPhases.workflowType, wt) : undefined)
        .orderBy(asc(workflowPhases.status));
      return rows.map((r) => r.status).filter(Boolean) as string[];
    }),

  /** Resolve agent names from an array of agent IDs (for supporting agents display) */
  resolveAgentNames: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()) }))
    .query(async ({ ctx, input }) => {
      if (input.ids.length === 0) return [];
      const rows = await ctx.db
        .select({ id: agents.id, firstName: agents.firstName, lastName: agents.lastName })
        .from(agents)
        .where(inArray(agents.id, input.ids));
      return rows.map((r) => ({
        id: r.id,
        name: `${r.firstName} ${r.lastName}`.trim(),
      }));
    }),

  /** List all agents — for the assign dropdown */
  listAgents: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ id: agents.id, firstName: agents.firstName, lastName: agents.lastName, email: agents.email })
      .from(agents)
      .orderBy(asc(agents.firstName), asc(agents.lastName));
    return rows.map((r) => ({
      id: r.id,
      name: `${r.firstName} ${r.lastName}`.trim(),
      email: r.email,
    }));
  }),

  // ──────────────────────────────────────────────────────────────
  // Incident Logs — CRUD tied to workflow phases
  // ──────────────────────────────────────────────────────────────

  listIncidents: protectedProcedure
    .input(z.object({ workflowId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: incidentLogs.id,
          workflowID: incidentLogs.workflowID,
          subcategory: incidentLogs.subcategory,
          critical: incidentLogs.critical,
          dateIdentified: incidentLogs.dateIdentified,
          resolutionDate: incidentLogs.resolutionDate,
          incidentDescription: incidentLogs.incidentDescription,
          immediateResolutionAttempt: incidentLogs.immediateResolutionAttempt,
          finalResolution: incidentLogs.finalResolution,
          preventativeActionTaken: incidentLogs.preventativeActionTaken,
          followUpRequired: incidentLogs.followUpRequired,
          followUpDate: incidentLogs.followUpDate,
          finalNotes: incidentLogs.finalNotes,
          discussed: incidentLogs.discussed,
          createdAt: incidentLogs.createdAt,
          reporterFirstName: agents.firstName,
          reporterLastName: agents.lastName,
        })
        .from(incidentLogs)
        .leftJoin(agents, eq(incidentLogs.whoReported, agents.id))
        .where(eq(incidentLogs.workflowID, input.workflowId))
        .orderBy(desc(incidentLogs.createdAt));

      return rows.map((r) => ({
        ...r,
        reporterName: r.reporterFirstName && r.reporterLastName
          ? `${r.reporterFirstName} ${r.reporterLastName}`.trim()
          : null,
      }));
    }),

  createIncident: protectedProcedure
    .input(
      z.object({
        workflowId: z.string().uuid(),
        subcategory: z.string().min(1, "Subcategory is required."),
        critical: z.boolean(),
        dateIdentified: z.string().min(1, "Date is required."),
        incidentDescription: z.string().optional(),
        immediateResolutionAttempt: z.string().optional(),
        escalatedTo: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      if (!actor) throw new Error("Agent record not found for current user.");

      const [created] = await ctx.db
        .insert(incidentLogs)
        .values({
          workflowID: input.workflowId,
          whoReported: actor.id,
          escalatedTo: input.escalatedTo,
          subcategory: input.subcategory,
          critical: input.critical,
          dateIdentified: input.dateIdentified,
          incidentDescription: toNull(input.incidentDescription),
          immediateResolutionAttempt: toNull(input.immediateResolutionAttempt),
        })
        .returning();

      await writeAuditLog(ctx.db, {
        tableName: "incident_logs",
        recordId: created!.id,
        action: "create",
        actorId: actor.id,
        actorEmail: actor.email,
        newData: created as unknown as Record<string, unknown>,
      });

      return created;
    }),

  updateIncident: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        subcategory: z.string().optional(),
        critical: z.boolean().optional(),
        resolutionDate: z.string().optional(),
        finalResolution: z.string().optional(),
        preventativeActionTaken: z.string().optional(),
        followUpRequired: z.boolean().optional(),
        followUpDate: z.string().optional(),
        finalNotes: z.string().optional(),
        discussed: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(incidentLogs)
        .where(eq(incidentLogs.id, input.id))
        .limit(1);

      if (!existing) throw new Error("Incident not found.");

      const actor = await resolveAgentId(ctx.db, ctx.user.id);

      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (input.subcategory !== undefined) set.subcategory = input.subcategory;
      if (input.critical !== undefined) set.critical = input.critical;
      if (input.resolutionDate !== undefined) set.resolutionDate = toNull(input.resolutionDate);
      if (input.finalResolution !== undefined) set.finalResolution = toNull(input.finalResolution);
      if (input.preventativeActionTaken !== undefined) set.preventativeActionTaken = toNull(input.preventativeActionTaken);
      if (input.followUpRequired !== undefined) set.followUpRequired = input.followUpRequired;
      if (input.followUpDate !== undefined) set.followUpDate = toNull(input.followUpDate);
      if (input.finalNotes !== undefined) set.finalNotes = toNull(input.finalNotes);
      if (input.discussed !== undefined) set.discussed = input.discussed;

      const [updated] = await ctx.db
        .update(incidentLogs)
        .set(set)
        .where(eq(incidentLogs.id, input.id))
        .returning();

      await writeAuditLog(ctx.db, {
        tableName: "incident_logs",
        recordId: input.id,
        action: "update",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        oldData: existing as unknown as Record<string, unknown>,
        newData: updated as unknown as Record<string, unknown>,
      });

      return updated;
    }),

  deleteIncident: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(incidentLogs)
        .where(eq(incidentLogs.id, input.id))
        .limit(1);

      if (!existing) throw new Error("Incident not found.");

      await ctx.db.delete(incidentLogs).where(eq(incidentLogs.id, input.id));

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "incident_logs",
        recordId: input.id,
        action: "delete",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        oldData: existing as unknown as Record<string, unknown>,
      });

      return { success: true };
    }),
});

import { z } from "zod";
import { eq, sql, ilike, and, desc, asc, count, inArray } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure, superAdminProcedure } from "~/server/api/trpc";
import {
  facilities,
  facilityContacts,
  facilityPreliveInfo,
  providerFacilityCredentials,
  workflowPhases,
} from "~/server/db/schema";
import { resolveAgentId, writeAuditLog } from "~/server/api/audit";

/** Convert empty / undefined / null strings to SQL null. */
function toNull(value: string | undefined | null): string | null {
  if (!value) return null;
  return value;
}

export const facilitiesRouter = createTRPCRouter({
  // ────────────────────────────────────────────────────────────────
  // Facility — Read
  // ────────────────────────────────────────────────────────────────

  /**
   * Paginated list of facilities with search & filter.
   */
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(50).default(15),
        search: z.string().optional(),
        activeOnly: z.boolean().optional(),
        sortBy: z.enum(["name", "state", "createdAt"]).default("name"),
        sortOrder: z.enum(["asc", "desc"]).default("asc"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, activeOnly, sortBy, sortOrder } = input;

      const conditions = [];
      if (search) {
        conditions.push(
          sql`(
            ${ilike(facilities.name, `%${search}%`)}
            OR ${ilike(facilities.state, `%${search}%`)}
            OR ${ilike(facilities.email, `%${search}%`)}
            OR ${ilike(facilities.address, `%${search}%`)}
            OR ${ilike(facilities.proxy, `%${search}%`)}
          )`,
        );
      }
      if (activeOnly) {
        conditions.push(eq(facilities.status, "Active"));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const sortCol = {
        name: facilities.name,
        state: facilities.state,
        createdAt: facilities.createdAt,
      }[sortBy];

      const orderFn = sortOrder === "desc" ? desc : asc;

      const [totalResult, rows] = await Promise.all([
        ctx.db.select({ total: count() }).from(facilities).where(where),
        ctx.db
          .select({
            id: facilities.id,
            name: facilities.name,
            state: facilities.state,
            proxy: facilities.proxy,
            status: facilities.status,
            email: facilities.email,
            address: facilities.address,
            createdAt: facilities.createdAt,
            updatedAt: facilities.updatedAt,
          })
          .from(facilities)
          .where(where)
          .orderBy(orderFn(sortCol))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
      ]);

      const total = totalResult[0]?.total ?? 0;

      return {
        items: rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  /**
   * Get a single facility by ID.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [facility] = await ctx.db
        .select()
        .from(facilities)
        .where(eq(facilities.id, input.id))
        .limit(1);

      if (!facility) {
        throw new Error("Facility not found.");
      }

      return facility;
    }),

  /**
   * Get contacts for a facility.
   */
  getContacts: protectedProcedure
    .input(z.object({ facilityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const contacts = await ctx.db
        .select({
          id: facilityContacts.id,
          name: facilityContacts.name,
          title: facilityContacts.title,
          email: facilityContacts.email,
          phone: facilityContacts.phone,
          isPrimary: facilityContacts.isPrimary,
        })
        .from(facilityContacts)
        .where(eq(facilityContacts.facilityId, input.facilityId))
        .orderBy(desc(facilityContacts.isPrimary), asc(facilityContacts.name));

      return contacts;
    }),

  // ────────────────────────────────────────────────────────────────
  // Facility — Update
  // ────────────────────────────────────────────────────────────────

  updateFacility: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).optional(),
        state: z.string().trim().max(2).optional(),
        email: z.string().trim().email().optional().or(z.literal("")),
        address: z.string().trim().optional(),
        proxy: z.string().trim().optional(),
        status: z.enum(["Active", "Inactive", "In Progress"]).optional(),
        yearlyVolume: z.number().int().nonnegative().nullable().optional(),
        modalities: z.array(z.string()).nullable().optional(),
        tatSla: z.string().trim().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [existing] = await ctx.db
        .select()
        .from(facilities)
        .where(eq(facilities.id, id))
        .limit(1);

      if (!existing) throw new Error("Facility not found.");

      const setFields: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.name !== undefined) setFields.name = updates.name;
      if (updates.state !== undefined) setFields.state = toNull(updates.state.toUpperCase());
      if (updates.email !== undefined) setFields.email = toNull(updates.email.toLowerCase());
      if (updates.address !== undefined) setFields.address = toNull(updates.address);
      if (updates.proxy !== undefined) setFields.proxy = toNull(updates.proxy);
      if (updates.status !== undefined) setFields.status = updates.status;
      if (updates.yearlyVolume !== undefined) setFields.yearlyVolume = updates.yearlyVolume;
      if (updates.modalities !== undefined) setFields.modalities = updates.modalities;
      if (updates.tatSla !== undefined) setFields.tatSla = toNull(updates.tatSla);

      const [updated] = await ctx.db
        .update(facilities)
        .set(setFields)
        .where(eq(facilities.id, id))
        .returning();

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "facilities",
        recordId: id,
        action: "update",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        oldData: existing as unknown as Record<string, unknown>,
        newData: updated as unknown as Record<string, unknown>,
      });

      return updated;
    }),

  // ────────────────────────────────────────────────────────────────
  // Facility — Delete (superadmin only)
  // ────────────────────────────────────────────────────────────────

  deleteFacility: superAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(facilities)
        .where(eq(facilities.id, input.id))
        .limit(1);

      if (!existing) throw new Error("Facility not found.");

      // Clean up child records first
      await ctx.db.delete(facilityContacts).where(eq(facilityContacts.facilityId, input.id));
      await ctx.db.delete(facilityPreliveInfo).where(eq(facilityPreliveInfo.facilityId, input.id));

      // Delete PFC-linked workflow phases
      const pfcRows = await ctx.db
        .select({ id: providerFacilityCredentials.id })
        .from(providerFacilityCredentials)
        .where(eq(providerFacilityCredentials.facilityId, input.id));

      if (pfcRows.length > 0) {
        const pfcIds = pfcRows.map((r) => r.id);
        await ctx.db
          .delete(workflowPhases)
          .where(
            and(
              eq(workflowPhases.workflowType, "pfc"),
              inArray(workflowPhases.relatedId, pfcIds),
            ),
          );
        await ctx.db
          .delete(providerFacilityCredentials)
          .where(eq(providerFacilityCredentials.facilityId, input.id));
      }

      const [deleted] = await ctx.db
        .delete(facilities)
        .where(eq(facilities.id, input.id))
        .returning();

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "facilities",
        recordId: input.id,
        action: "delete",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        oldData: existing as unknown as Record<string, unknown>,
      });

      return { success: true, deleted };
    }),

  // ────────────────────────────────────────────────────────────────
  // Facility Contacts — CRUD
  // ────────────────────────────────────────────────────────────────

  createContact: protectedProcedure
    .input(
      z.object({
        facilityId: z.string().uuid(),
        name: z.string().trim().min(1, "Name is required"),
        title: z.string().trim().optional(),
        email: z.string().trim().email().optional().or(z.literal("")),
        phone: z.string().trim().optional(),
        isPrimary: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(facilityContacts)
        .values({
          facilityId: input.facilityId,
          name: input.name,
          title: toNull(input.title),
          email: toNull(input.email?.toLowerCase()),
          phone: toNull(input.phone),
          isPrimary: input.isPrimary ?? false,
        })
        .returning();

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "facility_contacts",
        recordId: created!.id,
        action: "create",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        newData: created as unknown as Record<string, unknown>,
      });

      return created;
    }),

  updateContact: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).optional(),
        title: z.string().trim().optional(),
        email: z.string().trim().email().optional().or(z.literal("")),
        phone: z.string().trim().optional(),
        isPrimary: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [existing] = await ctx.db
        .select()
        .from(facilityContacts)
        .where(eq(facilityContacts.id, id))
        .limit(1);

      if (!existing) throw new Error("Contact not found.");

      const setFields: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.name !== undefined) setFields.name = updates.name;
      if (updates.title !== undefined) setFields.title = toNull(updates.title);
      if (updates.email !== undefined) setFields.email = toNull(updates.email?.toLowerCase());
      if (updates.phone !== undefined) setFields.phone = toNull(updates.phone);
      if (updates.isPrimary !== undefined) setFields.isPrimary = updates.isPrimary;

      const [updated] = await ctx.db
        .update(facilityContacts)
        .set(setFields)
        .where(eq(facilityContacts.id, id))
        .returning();

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "facility_contacts",
        recordId: id,
        action: "update",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        oldData: existing as unknown as Record<string, unknown>,
        newData: updated as unknown as Record<string, unknown>,
      });

      return updated;
    }),

  deleteContact: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(facilityContacts)
        .where(eq(facilityContacts.id, input.id))
        .limit(1);

      if (!existing) throw new Error("Contact not found.");

      await ctx.db
        .delete(facilityContacts)
        .where(eq(facilityContacts.id, input.id));

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "facility_contacts",
        recordId: input.id,
        action: "delete",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        oldData: existing as unknown as Record<string, unknown>,
      });

      return { success: true };
    }),

  toggleContactPrimary: protectedProcedure
    .input(z.object({ id: z.string().uuid(), isPrimary: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(facilityContacts)
        .where(eq(facilityContacts.id, input.id))
        .limit(1);

      if (!existing) throw new Error("Contact not found.");

      const [updated] = await ctx.db
        .update(facilityContacts)
        .set({ isPrimary: input.isPrimary, updatedAt: new Date() })
        .where(eq(facilityContacts.id, input.id))
        .returning();

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "facility_contacts",
        recordId: input.id,
        action: "update",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        oldData: { isPrimary: existing.isPrimary },
        newData: { isPrimary: input.isPrimary },
      });

      return updated;
    }),

  // ────────────────────────────────────────────────────────────────
  // Facility Pre-live Info — CRUD
  // ────────────────────────────────────────────────────────────────

  createPrelive: protectedProcedure
    .input(
      z.object({
        facilityId: z.string().uuid(),
        priority: z.string().trim().optional(),
        goLiveDate: z.string().optional(),
        boardMeetingDate: z.string().optional(),
        credentialingDueDate: z.string().optional(),
        tempsPossible: z.boolean().nullable().optional(),
        rolesNeeded: z.array(z.string()).optional(),
        payorEnrollmentRequired: z.boolean().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(facilityPreliveInfo)
        .values({
          facilityId: input.facilityId,
          priority: toNull(input.priority),
          goLiveDate: toNull(input.goLiveDate),
          boardMeetingDate: toNull(input.boardMeetingDate),
          credentialingDueDate: toNull(input.credentialingDueDate),
          tempsPossible: input.tempsPossible ?? null,
          rolesNeeded: input.rolesNeeded ?? null,
          payorEnrollmentRequired: input.payorEnrollmentRequired ?? null,
        })
        .returning();

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "facility_prelive_info",
        recordId: created!.id,
        action: "create",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        newData: created as unknown as Record<string, unknown>,
      });

      return created;
    }),

  updatePrelive: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        priority: z.string().trim().optional(),
        goLiveDate: z.string().optional(),
        boardMeetingDate: z.string().optional(),
        credentialingDueDate: z.string().optional(),
        tempsPossible: z.boolean().nullable().optional(),
        rolesNeeded: z.array(z.string()).optional(),
        payorEnrollmentRequired: z.boolean().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [existing] = await ctx.db
        .select()
        .from(facilityPreliveInfo)
        .where(eq(facilityPreliveInfo.id, id))
        .limit(1);

      if (!existing) throw new Error("Pre-live record not found.");

      const setFields: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.priority !== undefined) setFields.priority = toNull(updates.priority);
      if (updates.goLiveDate !== undefined) setFields.goLiveDate = toNull(updates.goLiveDate);
      if (updates.boardMeetingDate !== undefined) setFields.boardMeetingDate = toNull(updates.boardMeetingDate);
      if (updates.credentialingDueDate !== undefined) setFields.credentialingDueDate = toNull(updates.credentialingDueDate);
      if (updates.tempsPossible !== undefined) setFields.tempsPossible = updates.tempsPossible;
      if (updates.rolesNeeded !== undefined) setFields.rolesNeeded = updates.rolesNeeded;
      if (updates.payorEnrollmentRequired !== undefined) setFields.payorEnrollmentRequired = updates.payorEnrollmentRequired;

      const [updated] = await ctx.db
        .update(facilityPreliveInfo)
        .set(setFields)
        .where(eq(facilityPreliveInfo.id, id))
        .returning();

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "facility_prelive_info",
        recordId: id,
        action: "update",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        oldData: existing as unknown as Record<string, unknown>,
        newData: updated as unknown as Record<string, unknown>,
      });

      return updated;
    }),

  deletePrelive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(facilityPreliveInfo)
        .where(eq(facilityPreliveInfo.id, input.id))
        .limit(1);

      if (!existing) throw new Error("Pre-live record not found.");

      await ctx.db
        .delete(facilityPreliveInfo)
        .where(eq(facilityPreliveInfo.id, input.id));

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "facility_prelive_info",
        recordId: input.id,
        action: "delete",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        oldData: existing as unknown as Record<string, unknown>,
      });

      return { success: true };
    }),

  // ────────────────────────────────────────────────────────────────
  // Provider—Facility Credentials (PFC) — CRUD
  // ────────────────────────────────────────────────────────────────

  createPfc: protectedProcedure
    .input(
      z.object({
        facilityId: z.string().uuid(),
        providerId: z.string().uuid(),
        facilityType: z.string().trim().optional(),
        privileges: z.string().trim().optional(),
        decision: z.string().trim().optional(),
        notes: z.string().trim().optional(),
        priority: z.string().trim().optional(),
        formSize: z.enum(["small", "medium", "large", "x-large", "online"]).optional(),
        applicationRequired: z.boolean().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(providerFacilityCredentials)
        .values({
          facilityId: input.facilityId,
          providerId: input.providerId,
          facilityType: toNull(input.facilityType),
          privileges: toNull(input.privileges),
          decision: toNull(input.decision),
          notes: toNull(input.notes),
          priority: toNull(input.priority),
          formSize: input.formSize ?? null,
          applicationRequired: input.applicationRequired ?? null,
        })
        .returning();

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "provider_facility_credentials",
        recordId: created!.id,
        action: "create",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        newData: created as unknown as Record<string, unknown>,
      });

      return created;
    }),

  updatePfc: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        facilityType: z.string().trim().optional(),
        privileges: z.string().trim().optional(),
        decision: z.string().trim().optional(),
        notes: z.string().trim().optional(),
        priority: z.string().trim().optional(),
        formSize: z.enum(["small", "medium", "large", "x-large", "online"]).nullable().optional(),
        applicationRequired: z.boolean().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [existing] = await ctx.db
        .select()
        .from(providerFacilityCredentials)
        .where(eq(providerFacilityCredentials.id, id))
        .limit(1);

      if (!existing) throw new Error("PFC record not found.");

      const setFields: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.facilityType !== undefined) setFields.facilityType = toNull(updates.facilityType);
      if (updates.privileges !== undefined) setFields.privileges = toNull(updates.privileges);
      if (updates.decision !== undefined) setFields.decision = toNull(updates.decision);
      if (updates.notes !== undefined) setFields.notes = toNull(updates.notes);
      if (updates.priority !== undefined) setFields.priority = toNull(updates.priority);
      if (updates.formSize !== undefined) setFields.formSize = updates.formSize;
      if (updates.applicationRequired !== undefined) setFields.applicationRequired = updates.applicationRequired;

      const [updated] = await ctx.db
        .update(providerFacilityCredentials)
        .set(setFields)
        .where(eq(providerFacilityCredentials.id, id))
        .returning();

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "provider_facility_credentials",
        recordId: id,
        action: "update",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        oldData: existing as unknown as Record<string, unknown>,
        newData: updated as unknown as Record<string, unknown>,
      });

      return updated;
    }),

  deletePfc: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(providerFacilityCredentials)
        .where(eq(providerFacilityCredentials.id, input.id))
        .limit(1);

      if (!existing) throw new Error("PFC record not found.");

      // Delete linked workflow phases first
      await ctx.db
        .delete(workflowPhases)
        .where(
          and(
            eq(workflowPhases.workflowType, "pfc"),
            eq(workflowPhases.relatedId, input.id),
          ),
        );

      await ctx.db
        .delete(providerFacilityCredentials)
        .where(eq(providerFacilityCredentials.id, input.id));

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "provider_facility_credentials",
        recordId: input.id,
        action: "delete",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        oldData: existing as unknown as Record<string, unknown>,
      });

      return { success: true };
    }),

  // ────────────────────────────────────────────────────────────────
  // Workflow Phases (PFC) — Create / Delete
  // ────────────────────────────────────────────────────────────────

  createWorkflowPhase: protectedProcedure
    .input(
      z.object({
        relatedId: z.string().uuid(),
        phaseName: z.string().trim().min(1, "Phase name is required"),
        status: z.string().trim().optional(),
        startDate: z.string().min(1, "Start date is required"),
        dueDate: z.string().min(1, "Due date is required"),
        completedAt: z.string().optional(),
        agentAssigned: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the PFC record exists
      const [pfc] = await ctx.db
        .select({ id: providerFacilityCredentials.id })
        .from(providerFacilityCredentials)
        .where(eq(providerFacilityCredentials.id, input.relatedId))
        .limit(1);

      if (!pfc) throw new Error("Related PFC record not found.");

      const [created] = await ctx.db
        .insert(workflowPhases)
        .values({
          workflowType: "pfc",
          relatedId: input.relatedId,
          phaseName: input.phaseName,
          status: toNull(input.status) ?? "Pending",
          startDate: input.startDate,
          dueDate: input.dueDate,
          completedAt: toNull(input.completedAt),
          agentAssigned: input.agentAssigned ?? null,
        })
        .returning();

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "workflow_phases",
        recordId: created!.id,
        action: "create",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        newData: created as unknown as Record<string, unknown>,
      });

      return created;
    }),

  deleteWorkflowPhase: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(workflowPhases)
        .where(eq(workflowPhases.id, input.id))
        .limit(1);

      if (!existing) throw new Error("Workflow phase not found.");

      await ctx.db
        .delete(workflowPhases)
        .where(eq(workflowPhases.id, input.id));

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "workflow_phases",
        recordId: input.id,
        action: "delete",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        oldData: existing as unknown as Record<string, unknown>,
      });

      return { success: true };
    }),
});

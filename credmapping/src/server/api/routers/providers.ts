import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure, superAdminProcedure } from "~/server/api/trpc";
import {
  providers,
  providerStateLicenses,
  providerVestaPrivileges,
  providerFacilityCredentials,
  workflowPhases,
} from "~/server/db/schema";
import { resolveAgentId, writeAuditLog } from "~/server/api/audit";

/** Convert empty / undefined / null strings to SQL null. */
function toNull(value: string | undefined | null): string | null {
  if (!value) return null;
  return value;
}

export const providersRouter = createTRPCRouter({
  // ────────────────────────────────────────────────────────────────
  // Provider — Read
  // ────────────────────────────────────────────────────────────────

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [provider] = await ctx.db
        .select()
        .from(providers)
        .where(eq(providers.id, input.id))
        .limit(1);

      if (!provider) throw new Error("Provider not found.");
      return provider;
    }),

  // ────────────────────────────────────────────────────────────────
  // Provider — Update
  // ────────────────────────────────────────────────────────────────

  updateProvider: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        firstName: z.string().trim().min(1).optional(),
        middleName: z.string().trim().optional(),
        lastName: z.string().trim().min(1).optional(),
        degree: z.string().trim().optional(),
        email: z.string().trim().email().optional().or(z.literal("")),
        phone: z.string().trim().optional(),
        notes: z.string().trim().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [existing] = await ctx.db
        .select()
        .from(providers)
        .where(eq(providers.id, id))
        .limit(1);

      if (!existing) throw new Error("Provider not found.");

      const setFields: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.firstName !== undefined) setFields.firstName = updates.firstName;
      if (updates.middleName !== undefined) setFields.middleName = toNull(updates.middleName);
      if (updates.lastName !== undefined) setFields.lastName = updates.lastName;
      if (updates.degree !== undefined) setFields.degree = toNull(updates.degree);
      if (updates.email !== undefined) setFields.email = toNull(updates.email?.toLowerCase());
      if (updates.phone !== undefined) setFields.phone = toNull(updates.phone);
      if (updates.notes !== undefined) setFields.notes = toNull(updates.notes);

      const [updated] = await ctx.db
        .update(providers)
        .set(setFields)
        .where(eq(providers.id, id))
        .returning();

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "providers",
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
  // Provider — Delete (superadmin only)
  // ────────────────────────────────────────────────────────────────

  deleteProvider: superAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(providers)
        .where(eq(providers.id, input.id))
        .limit(1);

      if (!existing) throw new Error("Provider not found.");

      // Delete state licenses
      await ctx.db
        .delete(providerStateLicenses)
        .where(eq(providerStateLicenses.providerId, input.id));

      // Delete vesta privileges
      await ctx.db
        .delete(providerVestaPrivileges)
        .where(eq(providerVestaPrivileges.providerId, input.id));

      // Delete PFC-linked workflow phases, then PFC records
      const pfcRows = await ctx.db
        .select({ id: providerFacilityCredentials.id })
        .from(providerFacilityCredentials)
        .where(eq(providerFacilityCredentials.providerId, input.id));

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
          .where(eq(providerFacilityCredentials.providerId, input.id));
      }

      const [deleted] = await ctx.db
        .delete(providers)
        .where(eq(providers.id, input.id))
        .returning();

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "providers",
        recordId: input.id,
        action: "delete",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        oldData: existing as unknown as Record<string, unknown>,
      });

      return { success: true, deleted };
    }),

  // ────────────────────────────────────────────────────────────────
  // State Licenses — CRUD
  // ────────────────────────────────────────────────────────────────

  createLicense: protectedProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        state: z.string().trim().optional(),
        status: z.string().trim().optional(),
        path: z.string().trim().optional(),
        priority: z.string().trim().optional(),
        initialOrRenewal: z.enum(["initial", "renewal"]).optional(),
        expiresAt: z.string().optional(),
        startsAt: z.string().optional(),
        number: z.string().trim().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(providerStateLicenses)
        .values({
          providerId: input.providerId,
          state: toNull(input.state?.toUpperCase()),
          status: toNull(input.status),
          path: toNull(input.path),
          priority: toNull(input.priority),
          initialOrRenewal: input.initialOrRenewal ?? null,
          expiresAt: toNull(input.expiresAt),
          startsAt: toNull(input.startsAt),
          number: toNull(input.number),
        })
        .returning();

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "provider_state_licenses",
        recordId: created!.id,
        action: "create",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        newData: created as unknown as Record<string, unknown>,
      });

      return created;
    }),

  updateLicense: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        state: z.string().trim().optional(),
        status: z.string().trim().optional(),
        path: z.string().trim().optional(),
        priority: z.string().trim().optional(),
        initialOrRenewal: z.enum(["initial", "renewal"]).nullable().optional(),
        expiresAt: z.string().optional(),
        startsAt: z.string().optional(),
        number: z.string().trim().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [existing] = await ctx.db
        .select()
        .from(providerStateLicenses)
        .where(eq(providerStateLicenses.id, id))
        .limit(1);

      if (!existing) throw new Error("License not found.");

      const setFields: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.state !== undefined) setFields.state = toNull(updates.state?.toUpperCase());
      if (updates.status !== undefined) setFields.status = toNull(updates.status);
      if (updates.path !== undefined) setFields.path = toNull(updates.path);
      if (updates.priority !== undefined) setFields.priority = toNull(updates.priority);
      if (updates.initialOrRenewal !== undefined) setFields.initialOrRenewal = updates.initialOrRenewal;
      if (updates.expiresAt !== undefined) setFields.expiresAt = toNull(updates.expiresAt);
      if (updates.startsAt !== undefined) setFields.startsAt = toNull(updates.startsAt);
      if (updates.number !== undefined) setFields.number = toNull(updates.number);

      const [updated] = await ctx.db
        .update(providerStateLicenses)
        .set(setFields)
        .where(eq(providerStateLicenses.id, id))
        .returning();

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "provider_state_licenses",
        recordId: id,
        action: "update",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        oldData: existing as unknown as Record<string, unknown>,
        newData: updated as unknown as Record<string, unknown>,
      });

      return updated;
    }),

  deleteLicense: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(providerStateLicenses)
        .where(eq(providerStateLicenses.id, input.id))
        .limit(1);

      if (!existing) throw new Error("License not found.");

      await ctx.db
        .delete(providerStateLicenses)
        .where(eq(providerStateLicenses.id, input.id));

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "provider_state_licenses",
        recordId: input.id,
        action: "delete",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        oldData: existing as unknown as Record<string, unknown>,
      });

      return { success: true };
    }),

  // ────────────────────────────────────────────────────────────────
  // Vesta Privileges — CRUD
  // ────────────────────────────────────────────────────────────────

  createPrivilege: protectedProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        privilegeTier: z.enum(["Inactive", "Full", "Temp", "In Progress"]).optional(),
        currentPrivInitDate: z.string().optional(),
        currentPrivEndDate: z.string().optional(),
        termDate: z.string().optional(),
        termReason: z.string().trim().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(providerVestaPrivileges)
        .values({
          providerId: input.providerId,
          privilegeTier: input.privilegeTier ?? null,
          currentPrivInitDate: toNull(input.currentPrivInitDate),
          currentPrivEndDate: toNull(input.currentPrivEndDate),
          termDate: toNull(input.termDate),
          termReason: toNull(input.termReason),
        })
        .returning();

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "provider_vesta_privileges",
        recordId: created!.id,
        action: "create",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        newData: created as unknown as Record<string, unknown>,
      });

      return created;
    }),

  updatePrivilege: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        privilegeTier: z.enum(["Inactive", "Full", "Temp", "In Progress"]).nullable().optional(),
        currentPrivInitDate: z.string().optional(),
        currentPrivEndDate: z.string().optional(),
        termDate: z.string().optional(),
        termReason: z.string().trim().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [existing] = await ctx.db
        .select()
        .from(providerVestaPrivileges)
        .where(eq(providerVestaPrivileges.id, id))
        .limit(1);

      if (!existing) throw new Error("Privilege record not found.");

      const setFields: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.privilegeTier !== undefined) setFields.privilegeTier = updates.privilegeTier;
      if (updates.currentPrivInitDate !== undefined) setFields.currentPrivInitDate = toNull(updates.currentPrivInitDate);
      if (updates.currentPrivEndDate !== undefined) setFields.currentPrivEndDate = toNull(updates.currentPrivEndDate);
      if (updates.termDate !== undefined) setFields.termDate = toNull(updates.termDate);
      if (updates.termReason !== undefined) setFields.termReason = toNull(updates.termReason);

      const [updated] = await ctx.db
        .update(providerVestaPrivileges)
        .set(setFields)
        .where(eq(providerVestaPrivileges.id, id))
        .returning();

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "provider_vesta_privileges",
        recordId: id,
        action: "update",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        oldData: existing as unknown as Record<string, unknown>,
        newData: updated as unknown as Record<string, unknown>,
      });

      return updated;
    }),

  deletePrivilege: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(providerVestaPrivileges)
        .where(eq(providerVestaPrivileges.id, input.id))
        .limit(1);

      if (!existing) throw new Error("Privilege record not found.");

      await ctx.db
        .delete(providerVestaPrivileges)
        .where(eq(providerVestaPrivileges.id, input.id));

      const actor = await resolveAgentId(ctx.db, ctx.user.id);
      await writeAuditLog(ctx.db, {
        tableName: "provider_vesta_privileges",
        recordId: input.id,
        action: "delete",
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? ctx.user.email ?? null,
        oldData: existing as unknown as Record<string, unknown>,
      });

      return { success: true };
    }),
});

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";

import {
  createTRPCRouter,
  superAdminProcedure,
} from "~/server/api/trpc";
import { agents, authUsers, facilities, providers } from "~/server/db/schema";

export const superadminRouter = createTRPCRouter({
  /**
   * List all agents with their current roles.
   */
  listAgents: superAdminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: agents.id,
        userId: agents.userId,
        firstName: agents.firstName,
        lastName: agents.lastName,
        email: agents.email,
        team: agents.team,
        teamNumber: agents.teamNumber,
        role: agents.role,
        createdAt: agents.createdAt,
      })
      .from(agents)
      .orderBy(agents.firstName);

    return rows;
  }),

  /**
   * List users from the user pool who are NOT yet agents, for assignment.
   */
  listUnassignedUsers: superAdminProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const allUsers = await ctx.db
        .select({
          id: authUsers.id,
          email: authUsers.email,
          createdAt: authUsers.createdAt,
        })
        .from(authUsers)
        .where(sql`${authUsers.email} is not null`)
        .orderBy(authUsers.email);

      // Get all agent emails to exclude already-assigned users
      const agentEmails = await ctx.db
        .select({ email: agents.email })
        .from(agents);

      const assignedEmails = new Set(agentEmails.map((a) => a.email.toLowerCase()));

      const usersWithEmail = allUsers.flatMap((user) => {
        if (!user.email) return [];

        return {
          ...user,
          email: user.email,
        };
      });

      let unassigned = usersWithEmail.filter(
        (user) => !assignedEmails.has(user.email.toLowerCase()),
      );

      if (input?.search) {
        const q = input.search.toLowerCase();
        unassigned = unassigned.filter((user) => user.email.toLowerCase().includes(q));
      }

      return unassigned;
    }),

  /**
   * Create an agent record from a user in the pool.
   */
  assignAgent: superAdminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        email: z.string().email(),
        team: z.enum(["IN", "US"]),
        teamNumber: z.number().int().positive().optional(),
        role: z.enum(["user", "admin", "superadmin"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if agent already exists with this email
      const existing = await ctx.db
        .select({ id: agents.id })
        .from(agents)
        .where(eq(sql`lower(${agents.email})`, input.email.toLowerCase()))
        .limit(1);

      if (existing.length > 0) {
        throw new Error("An agent with this email already exists.");
      }

      const [newAgent] = await ctx.db
        .insert(agents)
        .values({
          userId: input.userId,
          firstName: "",
          lastName: "",
          email: input.email.toLowerCase(),
          team: input.team,
          teamNumber: input.teamNumber ?? null,
          role: input.role,
        })
        .returning();

      return newAgent;
    }),

  /**
   * Update an existing agent's team and role.
   */
  updateAgent: superAdminProcedure
    .input(
      z.object({
        agentId: z.string().uuid(),
        team: z.enum(["IN", "US"]),
        teamNumber: z.number().int().positive().nullable(),
        role: z.enum(["user", "admin", "superadmin"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [targetAgent] = await ctx.db
        .select({ userId: agents.userId })
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .limit(1);

      if (!targetAgent) {
        throw new Error("Agent not found.");
      }

      if (targetAgent.userId === ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot change your own permission level.",
        });
      }

      const [updated] = await ctx.db
        .update(agents)
        .set({
          team: input.team,
          teamNumber: input.teamNumber,
          role: input.role,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, input.agentId))
        .returning();

      if (!updated) {
        throw new Error("Agent not found.");
      }

      return updated;
    }),

  /**
   * Remove an agent (revoke their agent status).
   */
  removeAgent: superAdminProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [targetAgent] = await ctx.db
        .select({ userId: agents.userId })
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .limit(1);

      if (!targetAgent) {
        throw new Error("Agent not found.");
      }

      if (targetAgent.userId === ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot remove your own account.",
        });
      }

      const [deleted] = await ctx.db
        .delete(agents)
        .where(eq(agents.id, input.agentId))
        .returning();

      if (!deleted) {
        throw new Error("Agent not found.");
      }

      return { success: true };
    }),

  /**
   * Create a facility record.
   */
  createFacility: superAdminProcedure
    .input(
      z.object({
        name: z.string().trim().min(1, "Facility name is required"),
        state: z.string().trim().max(2).optional(),
        email: z.string().trim().email().optional(),
        address: z.string().trim().optional(),
        proxy: z.string().trim().optional(),
        tatSla: z.string().trim().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [newFacility] = await ctx.db
        .insert(facilities)
        .values({
          name: input.name,
          state: input.state?.toUpperCase() ?? null,
          email: input.email?.toLowerCase() ?? null,
          address: input.address ?? null,
          proxy: input.proxy ?? null,
          tatSla: input.tatSla ?? null,
          status: "Active",
        })
        .returning();

      return newFacility;
    }),

  /**
   * Create a provider record.
   */
  createProvider: superAdminProcedure
    .input(
      z.object({
        firstName: z.string().trim().min(1, "First name is required"),
        middleName: z.string().trim().optional(),
        lastName: z.string().trim().min(1, "Last name is required"),
        degree: z.string().trim().optional(),
        email: z.string().trim().email().optional(),
        phone: z.string().trim().optional(),
        notes: z.string().trim().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [newProvider] = await ctx.db
        .insert(providers)
        .values({
          firstName: input.firstName,
          middleName: input.middleName ?? null,
          lastName: input.lastName,
          degree: input.degree ?? null,
          email: input.email?.toLowerCase() ?? null,
          phone: input.phone ?? null,
          notes: input.notes ?? null,
        })
        .returning();

      return newProvider;
    }),
});

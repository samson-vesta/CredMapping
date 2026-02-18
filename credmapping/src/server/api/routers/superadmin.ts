import { z } from "zod";
import { eq, sql } from "drizzle-orm";

import {
  createTRPCRouter,
  superAdminProcedure,
} from "~/server/api/trpc";
import { agents, users } from "~/server/db/schema";

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
          id: users.id,
          email: users.email,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(users.email);

      // Get all agent emails to exclude already-assigned users
      const agentEmails = await ctx.db
        .select({ email: agents.email })
        .from(agents);

      const assignedEmails = new Set(
        agentEmails.map((a) => a.email.toLowerCase()),
      );

      let unassigned = allUsers.filter(
        (u) => !assignedEmails.has(u.email.toLowerCase()),
      );

      if (input?.search) {
        const q = input.search.toLowerCase();
        unassigned = unassigned.filter((u) =>
          u.email.toLowerCase().includes(q),
        );
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
        firstName: z.string().min(1, "First name is required"),
        lastName: z.string().min(1, "Last name is required"),
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
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email.toLowerCase(),
          team: input.team,
          teamNumber: input.teamNumber ?? null,
          role: input.role,
        })
        .returning();

      return newAgent;
    }),

  /**
   * Update an existing agent's role.
   */
  updateAgentRole: superAdminProcedure
    .input(
      z.object({
        agentId: z.string().uuid(),
        role: z.enum(["user", "admin", "superadmin"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(agents)
        .set({
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
      const [deleted] = await ctx.db
        .delete(agents)
        .where(eq(agents.id, input.agentId))
        .returning();

      if (!deleted) {
        throw new Error("Agent not found.");
      }

      return { success: true };
    }),
});

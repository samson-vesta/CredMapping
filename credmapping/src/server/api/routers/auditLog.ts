import { z } from "zod";
import { eq, desc, gte, lte, ilike, and, sql } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { auditLog } from "~/server/db/schema";

export const auditLogRouter = createTRPCRouter({
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

      const rows = await ctx.db
        .select()
        .from(auditLog)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(auditLog.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),
});

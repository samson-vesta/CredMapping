import { z } from "zod";
import { eq, sql, ilike, and, desc, asc, count } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { facilities, facilityContacts } from "~/server/db/schema";

export const facilitiesRouter = createTRPCRouter({
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
        sortBy: z
          .enum(["name", "state", "createdAt"])
          .default("name"),
        sortOrder: z.enum(["asc", "desc"]).default("asc"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, activeOnly, sortBy, sortOrder } = input;

      // Build WHERE conditions
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

      // Sort column map
      const sortCol = {
        name: facilities.name,
        state: facilities.state,
        createdAt: facilities.createdAt,
      }[sortBy];

      const orderFn = sortOrder === "desc" ? desc : asc;

      // Parallel: count + page data
      const [totalResult, rows] = await Promise.all([
        ctx.db
          .select({ total: count() })
          .from(facilities)
          .where(where),
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
});

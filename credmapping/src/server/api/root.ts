import { authRouter } from "~/server/api/routers/auth";
import { facilitiesRouter } from "~/server/api/routers/facilities";
import { searchRouter } from "~/server/api/routers/search";
import { superadminRouter } from "~/server/api/routers/superadmin";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * Add routers in /api/routers and register them here when needed.
 */
export const appRouter = createTRPCRouter({
  auth: authRouter,
  facilities: facilitiesRouter,
  search: searchRouter,
  superadmin: superadminRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 */
export const createCaller = createCallerFactory(appRouter);

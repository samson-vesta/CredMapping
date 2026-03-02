import { authRouter } from "~/server/api/routers/auth";
import { facilitiesRouter } from "~/server/api/routers/facilities";
import { providersRouter } from "~/server/api/routers/providers";
import { searchRouter } from "~/server/api/routers/search";
import { superadminRouter } from "~/server/api/routers/superadmin";
import { commLogsRouter, providersWithCommLogsRouter, facilitiesWithCommLogsRouter } from "~/server/api/routers/commLogs";
import { auditLogRouter } from "~/server/api/routers/auditLog";
import { workflowsRouter } from "~/server/api/routers/workflows";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * Add routers in /api/routers and register them here when needed.
 */
export const appRouter = createTRPCRouter({
  auth: authRouter,
  facilities: facilitiesRouter,
  providers: providersRouter,
  search: searchRouter,
  superadmin: superadminRouter,
  commLogs: commLogsRouter,
  providersWithCommLogs: providersWithCommLogsRouter,
  facilitiesWithCommLogs: facilitiesWithCommLogsRouter,
  auditLog: auditLogRouter,
  workflows: workflowsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 */
export const createCaller = createCallerFactory(appRouter);

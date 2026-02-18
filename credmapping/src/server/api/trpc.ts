/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { createServerClient } from "@supabase/ssr";
import { TRPCError, initTRPC } from "@trpc/server";
import { eq } from "drizzle-orm";
import superjson from "superjson";
import { ZodError } from "zod";

import { env } from "~/env";
import { getAppRole, isAllowedEmail } from "~/server/auth/domain";
import { db, withRls } from "~/server/db";
import { agents } from "~/server/db/schema";

const parseCookieHeader = (cookieHeader: string): { name: string; value: string }[] => {
  return cookieHeader
    .split(";")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => {
      const separator = chunk.indexOf("=");
      if (separator === -1) {
        return { name: chunk, value: "" };
      }

      return {
        name: chunk.slice(0, separator),
        value: decodeURIComponent(chunk.slice(separator + 1)),
      };
    });
};

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const cookieHeader = opts.headers.get("cookie") ?? "";
  const requestCookies = parseCookieHeader(cookieHeader);

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => requestCookies,
        setAll: () => {
          // No-op in tRPC fetch adapter context.
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const authenticatedUser = user && isAllowedEmail(user.email) ? user : null;

  const [agent] = authenticatedUser
    ? await withRls({
        jwtClaims: {
          sub: authenticatedUser.id,
          email: authenticatedUser.email?.toLowerCase() ?? "",
          role: "authenticated",
        },
        run: (tx) =>
          tx
            .select({ role: agents.role })
            .from(agents)
            .where(eq(agents.userId, authenticatedUser.id))
            .limit(1),
      })
    : [];

  return {
    db,
    user: authenticatedUser,
    appRole: authenticatedUser
      ? getAppRole({ agentRole: agent?.role })
      : "user",
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  // if (t._config.isDev) {
  //   // artificial delay in dev
  //   const waitMs = Math.floor(Math.random() * 400) + 100;
  //   await new Promise((resolve) => setTimeout(resolve, waitMs));
  // }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Please sign in." });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.appRole !== "superadmin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Super admin access required.",
    });
  }

  return next({ ctx });
});

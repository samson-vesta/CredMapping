import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "~/env";
import * as schema from "./schema";

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

type RlsRole = "anon" | "authenticated" | "service_role";

export type RlsUser = {
  id: string;
  email?: string | null;
};

const databaseUrl = env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL");
}

const conn = globalForDb.conn ?? postgres(databaseUrl, {
  max: 5,
  prepare: false,
});

if (env.NODE_ENV !== "production") {
  globalForDb.conn = conn;
}

export const db = drizzle({ client: conn, schema });

export type Db = typeof db;
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbClient = Db | DbTx;

const setLocalRole = (role: RlsRole) => {
  switch (role) {
    case "anon":
      return sql.raw("set local role anon");
    case "authenticated":
      return sql.raw("set local role authenticated");
    case "service_role":
      return sql.raw("set local role service_role");
  }
};

export const withRls = async <T>(params: {
  jwtClaims: {
    sub: string;
    email: string;
    role?: RlsRole;
  };
  run: (tx: DbTx) => Promise<T>;
}): Promise<T> => {
  return db.transaction(async (tx) => {
    const role = params.jwtClaims.role ?? "authenticated";

    await tx.execute(setLocalRole(role));
    await tx.execute(
      sql`select set_config('request.jwt.claims', ${JSON.stringify(params.jwtClaims)}, true)`,
    );

    return params.run(tx);
  });
};

export const withUserDb = async <T>(params: {
  user: RlsUser;
  role?: RlsRole;
  run: (tx: DbTx) => Promise<T>;
}): Promise<T> =>
  withRls({
    jwtClaims: {
      sub: params.user.id,
      email: params.user.email?.toLowerCase() ?? "",
      role: params.role ?? "authenticated",
    },
    run: params.run,
  });

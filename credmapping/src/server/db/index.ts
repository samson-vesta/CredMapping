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

const databaseUrl = process.env.DATABASE_POOLER_URL;

if (!databaseUrl) {
  throw new Error("Missing DATABASE_POOLER_URL");
}

const conn = globalForDb.conn ?? postgres(databaseUrl, {
  max: 5,
  prepare: false,
});

if (env.NODE_ENV !== "production") {
  globalForDb.conn = conn;
}

export const db = drizzle({ client: conn, schema });

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const withRls = async <T>(params: {
  jwtClaims: {
    sub: string;
    email: string;
    role?: string;
  };
  run: (tx: DbTx) => Promise<T>;
}): Promise<T> => {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('request.jwt.claims', ${JSON.stringify(params.jwtClaims)}, true)`,
    );

    return params.run(tx);
  });
};

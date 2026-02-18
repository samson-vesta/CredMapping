import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./src/migrations",
  dialect: "postgresql",

  schemaFilter: ["public"],

  migrations: {
    table: "journal",
    schema: "drizzle",
  },

  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
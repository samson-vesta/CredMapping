import postgres from "postgres";
import "dotenv/config.js"; 

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Database URL not found");
}

const sql = postgres(connectionString, { max: 1 });

async function cleanup() {
  console.log("Cleaning up hanging db sessions...");
  try {
    await sql`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid() 
        AND state = 'idle'
        AND usename = current_user;
    `;
    console.log("Hanging sessions cleared successfully.");
  } catch (error) {
    console.error("Failed to clear sessions:", error);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

cleanup().catch((error) => {
    console.error("Unexpected Error", error); 
    process.exit(1); 
});  
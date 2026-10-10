import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & { vocabsPool?: Pool };

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");

  if (!globalForDb.vocabsPool) {
    const pool = new Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      statement_timeout: 5000,
    });
    pool.on("error", (error) => console.error("Idle database connection failed", error));
    globalForDb.vocabsPool = pool;
  }
  return drizzle(globalForDb.vocabsPool);
}

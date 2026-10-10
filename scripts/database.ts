import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { demoVocabulary } from "../src/db/schema";

config({ path: ".env.local" });
config();

async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error("Set DATABASE_URL before running database commands");
  const command = process.argv[2];
  if (command !== "migrate" && command !== "seed") throw new Error("Expected migrate or seed");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  try {
    const db = drizzle(pool);
    if (command === "migrate") {
      await migrate(db, { migrationsFolder: "./drizzle" });
      console.log("Database migrations applied.");
    } else {
      await db
        .insert(demoVocabulary)
        .values([
          { word: "hej", translation: "hello" },
          { word: "tak", translation: "thank you" },
          { word: "hygge", translation: "coziness" },
        ])
        .onConflictDoNothing({ target: demoVocabulary.word });
      console.log("Demo vocabulary seeded.");
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

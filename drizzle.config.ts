import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Pick up .env.local the same way `next dev` does.
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});

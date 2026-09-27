import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";

// Comma-separated GitHub usernames allowed to sign in. Empty means anyone
// with a GitHub account can — fine locally, not what you want in production.
const allowedLogins = (process.env.ALLOWED_GITHUB_USERS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function assertAllowed(login: string | null | undefined) {
  if (allowedLogins.length === 0) return;
  if (!login || !allowedLogins.includes(login.toLowerCase())) {
    throw new APIError("FORBIDDEN", { message: "This GitHub account isn't allowed to sign in" });
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      // Keep githubLogin current if the user renames their GitHub account.
      overrideUserInfoOnSignIn: true,
      mapProfileToUser: (profile) => ({ githubLogin: profile.login }),
    },
  },
  user: {
    additionalFields: {
      githubLogin: { type: "string", required: false, input: false },
    },
  },
  // Check on user creation so strangers never get a row, and on every
  // session so removing someone from the allowlist locks them out.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => assertAllowed((user as { githubLogin?: string }).githubLogin),
      },
    },
    session: {
      create: {
        before: async (session) => {
          const [row] = await db
            .select({ githubLogin: schema.user.githubLogin })
            .from(schema.user)
            .where(eq(schema.user.id, session.userId));
          assertAllowed(row?.githubLogin);
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;

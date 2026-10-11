# Deployment and database

This application is hosted on **Coolify**, using the repository Dockerfile (Next.js standalone).
GitHub Actions publishes `ghcr.io/plsr/vocabs:latest` on `main` and triggers the Coolify
deployment webhook after checks pass; see `.github/workflows/main.yml` and `ci.yml`.
Production Postgres runs as a separate container managed in Coolify. Configure `DATABASE_URL`
as a runtime secret using the database's internal network address. Do not assume Vercel hosting.

Database access uses Drizzle ORM and `pg`. Schema: `src/db/schema.ts`; committed migrations:
`drizzle/`. Local Postgres: `docker compose up -d db`. See README for migration and seed commands.
The `/database` route is a public POC with dummy vocabulary only; SSO is not implemented yet.
Database queries run at request time; Docker builds must not require a running database.
The production container runs committed Drizzle migrations before starting Next.js.
`scripts/start.sh` calls the bundled `scripts/database.ts` runner; a session advisory
lock serializes migrations across deployments. Failure prevents startup. `DATABASE_URL`
is required at container startup. Seeding stays explicit: run `node database.cjs seed`
in the application container once for the POC. Never seed automatically on deployment.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

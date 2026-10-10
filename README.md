# Vocabs

Next.js application hosted on **Coolify**, built with the repository Dockerfile.
Postgres runs in a separate Coolify container. Drizzle ORM manages the schema and queries.
SSO is planned; this database integration is a proof of concept using public dummy vocabulary.

## Local development

Requirements: Node.js 24, pnpm 10, Docker with its daemon running.

```sh
pnpm install
cp -n .env.example .env.local
docker compose up -d --wait db
pnpm db:setup
pnpm dev
```

If `.env.local` already exists, add `DATABASE_URL` from `.env.example` to it.

Open http://localhost:3000/database to see `hej`, `tak`, and `hygge` read from
Postgres through Drizzle. The home page links to this demo. Refreshing queries the
database again. Missing configuration, connection failures, and an empty table
have explicit page states. The article reader can run without database configuration.
Set `DEEPL_API_KEY` in `.env.local` for translation.

The database listens on localhost:5432 with user/password/database `vocabs`.
These credentials are for local development only. If 5432 is occupied, change the
published port in `compose.yml` and the port in `.env.local` together.
Next.js and database scripts load `.env.local`; Compose's database uses its own
local defaults. The containerized app uses hostname `db` rather than `localhost`.

```sh
docker compose stop db             # stop, retain data
pnpm db:migrate                    # apply committed migrations
pnpm db:seed                       # insert dummy rows, safe to repeat
pnpm db:generate                   # generate a migration after schema edits
pnpm db:setup                      # migrate and seed
```

Data persists in the `postgres_data` volume. `docker compose down` retains it;
`docker compose down -v` deletes local database data. The seed uses unique words
and does not overwrite existing rows. Schema lives in `src/db/schema.ts`; generated
SQL and migration metadata in `drizzle/` must be committed together.

To run the app in Docker after database setup:

```sh
docker compose up -d app --build
```

## Coolify deployment

1. Keep the existing application deployment on port 3000. GitHub Actions builds the
   Dockerfile, publishes `ghcr.io/plsr/vocabs:latest` on `main`, and calls the Coolify
   deployment webhook after checks pass. Merging a PR therefore triggers deployment.
2. Create a Postgres 16 container in Coolify on the application's server, with a
   persistent volume and dedicated credentials. Start it and wait until healthy.
3. Ensure the app can reach Postgres on the internal Docker network. Set the app's
   runtime `DATABASE_URL` secret to the internal connection URL provided by Coolify
   (for example `postgresql://USER:PASSWORD@INTERNAL_HOST:5432/DATABASE`).
   URL-encode special characters in credentials. Use the TLS settings required by
   your database; do not disable certificate verification.
4. Apply migrations once per release from a checkout with development dependencies,
   running `pnpm db:migrate` with `DATABASE_URL` injected securely into that process.
   That process must have network access to the database. A local checkout cannot
   reach Coolify's internal hostname without a tunnel or equivalent access.
5. For this POC, run `pnpm db:seed` against the same database, then deploy/restart
   the application and visit `/database`.

Migrations and seeding are explicit operations, not application startup hooks.
The standalone runtime image does not include the development migration tooling;
use a checkout or dedicated release job with `pnpm install --frozen-lockfile`.
One option is to build the Dockerfile's `builder` stage from a checkout of the release
on the Coolify server, then run it as a one-off container on the network shared by
the application and database:

```sh
docker build --target builder -t vocabs-db-tools .
# Bash: paste the internal database URL without adding it to shell history.
read -rs -p 'Database URL: ' DATABASE_URL; echo
export DATABASE_URL
docker run --rm --network <shared-network> -e DATABASE_URL vocabs-db-tools pnpm db:setup
unset DATABASE_URL
```

Replace `<shared-network>` with the actual shared Docker network name. This image
includes development dependencies, scripts, and committed migrations. Subsequent
releases usually need only `pnpm db:migrate`; `db:setup` also seeds the POC rows.
Docker builds need no database URL or live database. Never put database credentials
in build arguments or `NEXT_PUBLIC_*` variables. The demo displays only dummy rows;
future user data will need authentication and authorization before exposure.

## Checks

```sh
pnpm lint
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

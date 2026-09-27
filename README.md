This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Requires Node 22, pnpm and Docker.

```bash
cp .env.example .env.local
pnpm install
pnpm db:up                   # Postgres in Docker on localhost:5432
pnpm db:migrate              # apply migrations in drizzle/
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Database scripts

| Script | What it does |
| --- | --- |
| `pnpm db:up` / `pnpm db:down` | Start or stop the local Postgres container |
| `pnpm db:generate` | Create a migration from changes to `src/db/schema.ts` |
| `pnpm db:migrate` | Apply pending migrations to `DATABASE_URL` |
| `pnpm db:studio` | Open Drizzle Studio |

### Production (Coolify)

Point `DATABASE_URL` at the Coolify Postgres resource's internal URL, and fill in the remaining variables from `.env.example`. Run `pnpm db:migrate` against that database before deploying a schema change.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

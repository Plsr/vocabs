import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { demoVocabulary } from "@/db/schema";

export default async function DatabasePage() {
  await connection();
  let words: (typeof demoVocabulary.$inferSelect)[] = [];
  let error: string | undefined;

  if (!process.env.DATABASE_URL) {
    error = "Set DATABASE_URL to connect to Postgres.";
  } else {
    try {
      words = await getDb().select().from(demoVocabulary).orderBy(demoVocabulary.id).limit(50);
    } catch (cause) {
      console.error("Database demo query failed", cause);
      error = "Could not load vocabulary. Check the database connection and run the migrations.";
    }
  }

  return (
    <main className="mx-auto max-w-3xl w-full p-8 space-y-6">
      <Link href="/" className="underline">
        Back to Vocabs
      </Link>
      <h1 className="text-2xl font-semibold">Database demo</h1>
      <p className="text-muted-foreground">Sample Danish vocabulary loaded from Postgres.</p>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : (
        <>
          <p>Connected · {words.length} sample words</p>
          {words.length === 0 ? (
            <p>No sample words yet. Run the database seed command.</p>
          ) : (
            <ul className="space-y-3">
              {words.map((entry) => (
                <li key={entry.id} className="rounded-lg border p-4 flex justify-between gap-4">
                  <span className="font-medium">{entry.word}</span>
                  <span className="text-muted-foreground">{entry.translation}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

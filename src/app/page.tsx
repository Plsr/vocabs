"use client";

import { useActionState } from "react";
import { fetchRawArticle, type FetchResult } from "./actions";

export default function Home() {
  const [state, formAction, pending] = useActionState<FetchResult | null, FormData>(
    fetchRawArticle,
    null,
  );

  return (
    <main className="mx-auto max-w-3xl w-full p-8">
      <h1 className="text-2xl font-semibold mb-6">Vocabs</h1>

      <form action={formAction} className="flex gap-2 mb-6">
        <input
          type="url"
          name="url"
          placeholder="https://example.com/article"
          required
          className="flex-1 rounded border px-3 py-2"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {pending ? "Fetching…" : "Fetch"}
        </button>
      </form>

      {state && "error" in state && <p className="text-red-600">{state.error}</p>}

      {state && "content" in state && (
        <pre className="whitespace-pre-wrap break-words rounded border bg-zinc-50 p-4 text-xs">
          {state.content}
        </pre>
      )}
    </main>
  );
}

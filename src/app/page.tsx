"use client";

import { useActionState } from "react";
import { fetchRawArticle, type ContentBlock, type FetchResult } from "./actions";

const HEADING_SIZE: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
  1: "text-3xl font-semibold",
  2: "text-2xl font-semibold",
  3: "text-xl font-semibold",
  4: "text-lg font-semibold",
  5: "text-lg font-semibold",
  6: "text-lg font-semibold",
};

function Block({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "heading": {
      const Tag = `h${block.level}` as const;
      return <Tag className={HEADING_SIZE[block.level]}>{block.text}</Tag>;
    }
    case "paragraph":
      return <p>{block.text}</p>;
    case "blockquote":
      return (
        <blockquote className="border-l-4 border-zinc-300 pl-4 italic text-foreground/80">
          {block.text}
        </blockquote>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag className={block.ordered ? "list-decimal pl-6" : "list-disc pl-6"}>
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </Tag>
      );
    }
  }
}

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

      {state && "blocks" in state && (
        <article className="max-w-prose space-y-4 font-serif text-lg leading-relaxed text-foreground">
          {state.title && <h1 className="text-3xl font-semibold">{state.title}</h1>}
          {state.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </article>
      )}
    </main>
  );
}

"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { fetchRawArticle, translate, type ContentBlock, type FetchResult } from "./actions";

const HEADING_SIZE: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
  1: "text-3xl font-semibold",
  2: "text-2xl font-semibold",
  3: "text-xl font-semibold",
  4: "text-lg font-semibold",
  5: "text-lg font-semibold",
  6: "text-lg font-semibold",
};

type Highlight = { id: string; segmentId: string; start: number; end: number; origin: string; translation: string };

// ponytail: djb2, not cryptographic — collisions are a shared highlight set
// between two URLs, not a security issue. Fine for a localStorage key.
function hashUrl(url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i++) h = (h * 33 + url.charCodeAt(i)) | 0;
  return `vocabs:highlights:${h}`;
}

type MenuState =
  | { kind: "new"; segmentId: string; start: number; end: number; text: string; left: number; top: number }
  | { kind: "existing"; highlightId: string; left: number; top: number };

// ponytail: walks text nodes to turn a Range boundary into a plain char
// offset. Assumes the boundary sits inside a text node (true for drag/
// double-click selections); a triple-click that selects a whole element
// gives a slightly-off offset. Upgrade if that turns out to matter.
function textOffset(root: Node, target: Node, targetOffset: number): number {
  if (target.nodeType !== Node.TEXT_NODE) return targetOffset;
  let total = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node === target) return total + targetOffset;
    total += node.textContent?.length ?? 0;
    node = walker.nextNode();
  }
  return total;
}

function splitText(text: string, ranges: Highlight[]) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const parts: { text: string; id?: string }[] = [];
  let cursor = 0;
  for (const r of sorted) {
    if (r.start > cursor) parts.push({ text: text.slice(cursor, r.start) });
    parts.push({ text: text.slice(r.start, r.end), id: r.id });
    cursor = r.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

function HighlightedText({
  segmentId,
  text,
  highlights,
}: {
  segmentId: string;
  text: string;
  highlights: Highlight[];
}) {
  const ranges = highlights.filter((h) => h.segmentId === segmentId);
  const parts = ranges.length ? splitText(text, ranges) : [{ text }];
  return (
    <span data-segment-id={segmentId}>
      {parts.map((p, i) =>
        p.id ? (
          <mark key={i} data-highlight-id={p.id} className="bg-yellow-200 cursor-pointer">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  );
}

function Block({
  block,
  index,
  highlights,
}: {
  block: ContentBlock;
  index: number;
  highlights: Highlight[];
}) {
  switch (block.type) {
    case "heading": {
      const Tag = `h${block.level}` as const;
      return (
        <Tag className={HEADING_SIZE[block.level]}>
          <HighlightedText segmentId={`${index}`} text={block.text} highlights={highlights} />
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p>
          <HighlightedText segmentId={`${index}`} text={block.text} highlights={highlights} />
        </p>
      );
    case "blockquote":
      return (
        <blockquote className="border-l-4 border-zinc-300 pl-4 italic text-foreground/80">
          <HighlightedText segmentId={`${index}`} text={block.text} highlights={highlights} />
        </blockquote>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag className={block.ordered ? "list-decimal pl-6" : "list-disc pl-6"}>
          {block.items.map((item, i) => (
            <li key={i}>
              <HighlightedText segmentId={`${index}:${i}`} text={item} highlights={highlights} />
            </li>
          ))}
        </Tag>
      );
    }
  }
}

function ContextMenu({
  menu,
  highlight,
  translating,
  translateError,
  onTranslate,
  onDelete,
}: {
  menu: MenuState;
  highlight: Highlight | undefined;
  translating: boolean;
  translateError: string | null;
  onTranslate: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{ position: "fixed", left: menu.left, top: menu.top }}
      className="z-50 rounded border bg-white text-zinc-900 shadow px-3 py-2 min-w-[10rem]"
    >
      {menu.kind === "new" ? (
        <div className="space-y-1">
          <div className="text-sm font-medium">{menu.text}</div>
          {translateError && <div className="text-sm text-red-600">{translateError}</div>}
          <button onClick={onTranslate} disabled={translating} className="text-sm text-blue-600 disabled:opacity-50">
            {translating ? "Translating…" : "Translate"}
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="text-sm font-medium">{highlight?.origin}</div>
          <div className="text-sm text-zinc-600">{highlight?.translation}</div>
          <button onClick={onDelete} className="text-sm text-red-600">
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [state, formAction, pending] = useActionState<FetchResult | null, FormData>(
    fetchRawArticle,
    null,
  );
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [articleUrl, setArticleUrl] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  useEffect(() => {
    if (!articleUrl || !state || !("blocks" in state)) return;
    try {
      const raw = localStorage.getItem(hashUrl(articleUrl));
      setHighlights(raw ? JSON.parse(raw) : []);
    } catch {
      setHighlights([]);
    }
  }, [articleUrl, state]);

  useEffect(() => {
    if (!articleUrl || !state || !("blocks" in state)) return;
    try {
      localStorage.setItem(hashUrl(articleUrl), JSON.stringify(highlights));
    } catch {
      // ponytail: storage unavailable (private mode, quota) — highlights just won't persist.
    }
  }, [articleUrl, state, highlights]);

  useEffect(() => {
    if (!menu) return;
    function onDocMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [menu]);

  function handleMouseUp(e: React.MouseEvent) {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim()) {
      const range = selection.getRangeAt(0);
      const anchor = range.commonAncestorContainer;
      const container = (anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor) as HTMLElement;
      const segmentEl = container?.closest<HTMLElement>("[data-segment-id]");
      if (!segmentEl) return;
      const segmentId = segmentEl.dataset.segmentId!;
      const start = textOffset(segmentEl, range.startContainer, range.startOffset);
      const end = textOffset(segmentEl, range.endContainer, range.endOffset);
      const rect = range.getBoundingClientRect();
      const text = selection.toString();
      setTranslateError(null);
      setMenu({ kind: "new", segmentId, start, end, text, left: rect.left, top: rect.bottom + 4 });
      return;
    }

    const markEl = (e.target as HTMLElement).closest<HTMLElement>("[data-highlight-id]");
    if (markEl) {
      const rect = markEl.getBoundingClientRect();
      setTranslateError(null);
      setMenu({ kind: "existing", highlightId: markEl.dataset.highlightId!, left: rect.left, top: rect.bottom + 4 });
      return;
    }

    setMenu(null);
  }

  async function handleTranslate() {
    if (menu?.kind !== "new") return;
    const { segmentId, start, end, text } = menu;
    setTranslating(true);
    setTranslateError(null);
    const result = await translate(text);
    setTranslating(false);
    if ("error" in result) {
      setTranslateError(result.error);
      return;
    }
    const id = crypto.randomUUID();
    setHighlights((hs) => [...hs, { id, segmentId, start, end, origin: text, translation: result.text }]);
    window.getSelection()?.removeAllRanges();
    setMenu((m) => (m?.kind === "new" ? { kind: "existing", highlightId: id, left: m.left, top: m.top } : m));
  }

  function deleteHighlight() {
    if (menu?.kind !== "existing") return;
    setHighlights((hs) => hs.filter((h) => h.id !== menu.highlightId));
    setMenu(null);
  }

  function exportToAnki() {
    if (!state || !("blocks" in state)) return;
    // ponytail: assumes origin/translation never contain a tab or newline —
    // true for selections within a single text run. Escape if that changes.
    const tsv = highlights.map((h) => `${h.origin}\t${h.translation}`).join("\n");
    const blob = new Blob([tsv], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(state.title || "vocabs").replace(/[^\w-]+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-3xl w-full p-8">
      <h1 className="text-2xl font-semibold mb-6">Vocabs</h1>

      <form
        action={formAction}
        onSubmit={(e) => setArticleUrl(String(new FormData(e.currentTarget).get("url") ?? ""))}
        className="flex gap-2 mb-6"
      >
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

      {state && "blocks" in state && highlights.length > 0 && (
        <button onClick={exportToAnki} className="mb-6 rounded border px-4 py-2 text-sm">
          Export {highlights.length} highlight{highlights.length === 1 ? "" : "s"} to Anki
        </button>
      )}

      {state && "blocks" in state && (
        <article
          onMouseUp={handleMouseUp}
          className="max-w-prose space-y-4 font-serif text-lg leading-relaxed text-foreground"
        >
          {state.title && <h1 className="text-3xl font-semibold">{state.title}</h1>}
          {state.blocks.map((block, i) => (
            <Block key={i} block={block} index={i} highlights={highlights} />
          ))}
        </article>
      )}

      {menu && (
        <div ref={menuRef}>
          <ContextMenu
            menu={menu}
            highlight={menu.kind === "existing" ? highlights.find((h) => h.id === menu.highlightId) : undefined}
            translating={translating}
            translateError={translateError}
            onTranslate={handleTranslate}
            onDelete={deleteHighlight}
          />
        </div>
      )}
    </main>
  );
}

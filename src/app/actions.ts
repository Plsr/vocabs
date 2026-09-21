"use server";

import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";

export type ContentBlock =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "blockquote"; text: string };

export type FetchResult = { title: string; blocks: ContentBlock[] } | { error: string };

// Readability's own scoring (link density, text length, tag semantics)
// identifies the article body and drops nav/ads/related-links cruft far
// more reliably than a hand-rolled selector blocklist would.
function extractArticle(html: string): { title: string; blocks: ContentBlock[] } | null {
  const { document } = parseHTML(html);
  const article = new Readability(document).parse();
  if (!article?.content) return null;

  // article.content is an HTML fragment (starts with a bare <div>), so
  // linkedom parses it with that div as documentElement — there is no <body>.
  const { document: contentDoc } = parseHTML(article.content);
  const root = contentDoc.body?.children.length ? contentDoc.body : contentDoc.documentElement;
  const blocks: ContentBlock[] = [];

  const walk = (parent: Element) => {
    for (const el of Array.from(parent.children)) {
      // linkedom preserves source tag casing instead of uppercasing it like
      // a spec-compliant DOM, so tagName comparisons must normalize case.
      const tag = el.tagName.toUpperCase();
      const heading = tag.match(/^H([1-6])$/);
      const text = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (heading) {
        if (text) blocks.push({ type: "heading", level: Number(heading[1]) as 1 | 2 | 3 | 4 | 5 | 6, text });
      } else if (tag === "P") {
        if (text) blocks.push({ type: "paragraph", text });
      } else if (tag === "BLOCKQUOTE") {
        if (text) blocks.push({ type: "blockquote", text });
      } else if (tag === "UL" || tag === "OL") {
        const items = Array.from(el.children)
          .filter((li) => li.tagName.toUpperCase() === "LI")
          .map((li) => li.textContent?.replace(/\s+/g, " ").trim() ?? "")
          .filter(Boolean);
        if (items.length) blocks.push({ type: "list", ordered: tag === "OL", items });
      } else {
        walk(el); // unwrap layout wrappers (div/section/etc.)
      }
    }
  };
  if (root) walk(root);

  return { title: article.title ?? "", blocks };
}

// ponytail: hostname/literal check only, no DNS resolution — a domain that
// resolves to a private IP still gets through. Upgrade if this app is ever
// exposed beyond personal use.
function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "0.0.0.0") return true;

  const ip = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ip) {
    const [a, b] = ip.slice(1, 3).map(Number);
    if (a === 127 || a === 10 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
      return true;
    }
  }
  return false;
}

export async function fetchRawArticle(
  _prevState: FetchResult | null,
  formData: FormData,
): Promise<FetchResult> {
  const url = formData.get("url");
  if (typeof url !== "string" || url.trim() === "") {
    return { error: "Enter a URL" };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { error: "Not a valid URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { error: "URL must be http or https" };
  }
  if (isBlockedHost(parsed.hostname)) {
    return { error: "That host isn't allowed" };
  }

  try {
    const res = await fetch(parsed, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; VocabsReader/1.0)" },
    });
    if (!res.ok) {
      return { error: `Fetch failed: ${res.status} ${res.statusText}` };
    }
    const article = extractArticle(await res.text());
    if (!article || article.blocks.length === 0) {
      return { error: "Couldn't find readable article content on that page" };
    }
    return article;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Fetch failed" };
  }
}

"use server";

import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export type ContentBlock =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "blockquote"; text: string };

export type FetchResult = { title: string; blocks: ContentBlock[] } | { error: string };

// Readability drops a wrapper div whose text is more than ~20% link text,
// so a prose sentence like "X har været i vælten, <a>fordi …</a>" (DR wraps
// every <p> in its own div) vanishes entirely. Flatten links inside
// paragraphs that are mostly real prose into plain text before scoring;
// link-only paragraphs ("Læs også: <a>…</a>") keep their links and still
// get filtered out as cruft.
const MIN_PROSE_SHARE = 0.3;

function unwrapProseLinks(document: Document) {
  for (const p of Array.from(document.querySelectorAll("p"))) {
    const links = Array.from(p.querySelectorAll("a"));
    if (links.length === 0) continue;
    const total = p.textContent?.trim().length ?? 0;
    const linked = links.reduce((n, a) => n + (a.textContent?.trim().length ?? 0), 0);
    if (total === 0 || (total - linked) / total < MIN_PROSE_SHARE) continue;
    for (const a of links) a.replaceWith(...Array.from(a.childNodes));
  }
}

// Readability's own scoring (link density, text length, tag semantics)
// identifies the article body and drops nav/ads/related-links cruft far
// more reliably than a hand-rolled selector blocklist would.
function extractArticle(html: string): { title: string; blocks: ContentBlock[] } | null {
  const { document } = parseHTML(html);
  unwrapProseLinks(document);
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

// Server actions are public POST endpoints, so each one checks the session
// itself rather than relying on the page having been gated.
async function isSignedIn(): Promise<boolean> {
  return (await auth.api.getSession({ headers: await headers() })) !== null;
}

export type TranslateResult = { text: string } | { error: string };

export async function translate(word: string): Promise<TranslateResult> {
  if (!(await isSignedIn())) {
    return { error: "Not signed in" };
  }
  if (word.trim() === "") {
    return { error: "Enter a word" };
  }

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    return { error: "DEEPL_API_KEY is not set" };
  }

  try {
    const res = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: [word], source_lang: "DA", target_lang: "EN" }),
    });
    if (!res.ok) {
      return { error: `DeepL request failed: ${res.status} ${res.statusText}` };
    }
    const data = await res.json();
    return { text: data.translations[0].text };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Translation failed" };
  }
}

export async function fetchRawArticle(
  _prevState: FetchResult | null,
  formData: FormData,
): Promise<FetchResult> {
  if (!(await isSignedIn())) {
    return { error: "Not signed in" };
  }
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

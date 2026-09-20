"use server";

import { parseHTML } from "linkedom";

export type FetchResult = { content: string } | { error: string };

function extractText(html: string): string {
  const { document } = parseHTML(html);
  document.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
  const text = document.body?.textContent ?? "";
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
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
    return { content: extractText(await res.text()) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Fetch failed" };
  }
}

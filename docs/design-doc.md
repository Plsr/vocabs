# Vocabs — Design Doc

As of 2026-09-20. Live version: https://claude.ai/code/artifact/773dd6fb-256b-4de7-95d9-94fe01616469

## Overview

Paste a URL, read the article in a clean view, mark unfamiliar words as you go, translate them, and export to CSV for Anki (or any SRS tool).

**Phase 1 (this doc's scope):** URL → reader view → manual source-language select → click-to-mark words → translate marked words via API → CSV export.

**Phase 2 (later, separate doc when we get there):** an agent chat scoped to the article for questions about phrasing/grammar ("why is this word in this form here?"). Kept out of phase 1 deliberately — translation should stay a fast, deterministic API call, not an agent round-trip.

## User flow

1. Paste an article URL.
2. Server fetches the page and extracts the article body (strip nav/ads/comments).
3. Pick the article's language from a dropdown (manual for phase 1).
4. Reader view renders; click words to mark them (toggle on/off). Marked words highlight inline and collect in a side list.
5. Press **Translate** — marked words go to the translation API in one batch, translations appear next to each word.
6. Press **Export CSV** — downloads word, translation, context sentence, source/target language, article title — ready to import into Anki as a Basic note type (front/back/extra).

## Architecture

One Next.js app (App Router), no separate backend.

**Article extraction** — a server action/route fetches the URL server-side (dodges CORS) and runs it through `@mozilla/readability` + `linkedom` to get clean article HTML, the same approach Pocket/Instapaper-style readers use. Sanitize with `isomorphic-dompurify` before rendering — it's arbitrary third-party HTML.

**Reader view + marking** — render the sanitized HTML, wrap words in spans client-side, click toggles a word's marked state. Store each marked word with its surrounding sentence as context (needed for the CSV and for disambiguating homonyms later).

**Data model** (two tables):

| Table          | Columns                                                                          |
| -------------- | -------------------------------------------------------------------------------- |
| `articles`     | id, url, title, language, created_at                                             |
| `marked_words` | id, article_id, word, context_sentence, translation, target_language, created_at |

**Translation** — on "Translate", batch the article's marked words to the translation API in one call, write results back to `marked_words.translation`.

**CSV export** — straight string-join of the four columns with quote-escaping; no library needed for a 4-column CSV.

## Tech stack decisions

| Piece              | Pick                                              | Why                                                                                                                                                                                   |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Translation API    | DeepL API (free tier)                             | Best quality for European languages, 500k chars/month free — plenty for personal reading volume. Google Cloud Translation is the fallback if DeepL doesn't cover a language you need. |
| Article extraction | `@mozilla/readability` + `linkedom`               | Same library Firefox Reader View uses; `linkedom` is a lighter DOM shim than `jsdom` for a serverless-friendly build.                                                                 |
| Database           | Neon (serverless Postgres, free tier)             | Matches the ask for a Neon-like free DB; branching is handy for testing schema changes without a local Postgres install.                                                              |
| ORM                | Drizzle                                           | Thin SQL-shaped layer, no codegen step, easy to read/audit — overkill to reach for Prisma's full engine for two tables.                                                               |
| Deployment         | Next.js standalone output, Dockerfile, on Coolify | Coolify handles the VPS orchestration; standalone output keeps the image small.                                                                                                       |

Skipped: no queue/job system for translation (a batch API call is fast enough to await inline), no auth yet (see open questions).

## Open questions / Phase 2

- [ ] **Auth** — single-user personal tool, or does anyone else get access? If it's just you, skip auth and rely on Coolify to keep the deployment private; add auth only if that changes.
- [ ] **Word form** — mark the word as it appears in the sentence (inflected), or also capture a base/lemma form for the Anki card? Affects whether the CSV needs a fifth column.
- [ ] **Multi-word marks** — phrases/collocations, or single words only for phase 1?
- [ ] **Article history** — keep a list of past articles to revisit, or is each article a one-off session?

**Phase 2:** an agent-backed chat scoped to the open article, for questions like "why is this verb in this tense here?" — uses an LLM with the article text as context, kept separate from the deterministic translation API so translation stays fast and cheap.

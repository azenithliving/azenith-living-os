# PHASE P1 — Grounding (agents see the real page, memory gets real embeddings)

> 🇪🇬 ملخص: وكيل السيو بقى يفتح الصفحة الحقيقية بـ cheerio قبل ما يحلل، ووكيل المرئي يشوف الصور الحقيقية من قاعدة البيانات، والـ embeddings بقت Gemini حقيقية (مجاناً بمفتاح موجود) بدل الهاش الوهمي — وتفعيل فهرس HNSW الموجود.

## Mission

Ground two hallucination-prone agents in fetched reality and replace fake hash embeddings with real Gemini embeddings, activating the existing pgvector HNSW index. No new keys, no new deps.

## Pre-flight verification

```bash
# 1. SEO agent never fetches the URL
sed -n '77,95p' lib/qayyim/QayyimSeoAgent.ts
# EXPECT: auditSEO builds a task and returns this.process(task) — NO fetch of params.url anywhere

# 2. Visual agent never loads real images for checks
sed -n '175,193p' lib/qayyim/QayyimVisualAgent.ts
# EXPECT: brandConsistencyCheck only builds a task — no media_assets/curated_images query

# 3. Fake embeddings
grep -n "hashToEmbedding" lib/qayyim/memory/SharedMemory.ts
# EXPECT: matches at :87 (call) and :100 (definition)

# 4. HNSW index exists for 1536-dim (stale vs Gemini 768)
grep -n "VECTOR\|hnsw" supabase/migrations/20260923_qayyim_foundation.sql
# EXPECT: qayyim_semantic_memory uses VECTOR(1536) with an HNSW index (:186, :201-204)

# 5. Gemini provider + key source
grep -n "gemini" lib/ai-orchestrator.ts | head -20
# EXPECT: gemini provider around :432 — READ that section to learn the exact env var / key resolution it uses. REUSE the same mechanism; do not invent a new env name.

# 6. Deps available
grep -n '"cheerio"\|"@google/generative-ai"' package.json
# EXPECT: cheerio ^1.2.0 (:49), @google/generative-ai ^0.24.1 (:36)
```

## Changes

| # | File | Change |
|---|------|--------|
| 1 | `lib/qayyim/QayyimSeoAgent.ts` — `auditSEO` (:77-95) | Before `this.process(task)`: if `process.env.NEXT_PUBLIC_SITE_URL` is unset → return a `QayyimResult` with `success:false` and error `"SITE_URL not configured"` (honest failure, no invented audit). Else `fetch(url)` the target (same-origin policy: refuse URLs whose origin ≠ `NEXT_PUBLIC_SITE_URL` origin → `success:false, error:"URL outside site"`; 8s AbortController timeout). Parse HTML with `cheerio`: extract `title`, meta description, canonical, all `h1` texts, all JSON-LD blocks, `img` count + missing-`alt` count, internal/external link counts. Attach to `task.context.evidence = { fetchedUrl, fetchedAt, title, metaDescription, canonical, h1s, jsonLd, imgCount, imgsMissingAlt, links }`. After `process()`: post-filter — drop every extracted issue whose `evidenceUrl` is not same-origin as the fetched URL, and add a warning `"فلترة: N ادعاءات بأدلة خارج النطاق حُذرت"` to the result. Parse-time claims (`seoScore`) stay as-is. |
| 2 | `lib/qayyim/QayyimVisualAgent.ts` — `brandConsistencyCheck` (:175-193) and `curateGallery` (:78-125) | Before `this.process(task)`: query REAL candidates via `supabaseServer` (`@/lib/dal/unified-supabase`): images from `media_assets` (or the storage/table the repo actually uses for site images — verify by reading how `curated_images` API lists assets) filtered by page/room when possible; fall back to the same source `curateGallery` already trusts. Build `candidateImages: Array<{ url, alt, source }>` (cap 60). Attach to `task.context.candidateImages`. After `process()`: filter `data.images` and `data.violations` to only URLs present in `candidateImages` (normalize by pathname); count dropped items into `data.filteredAsUnverified`. |
| 3 | `lib/qayyim/memory/SharedMemory.ts` — `generateEmbedding` (:76-94) | Replace body: call Gemini embeddings via `@google/generative-ai` (`GoogleGenerativeAI`, model `text-embedding-004`, `taskType: "RETRIEVAL_DOCUMENT"` for stores / `"RETRIEVAL_QUERY"` for searches — expose an optional param). Reuse the EXACT key resolution you found in pre-flight #5 (same env var / same api_keys table path the chat provider uses — factor a tiny shared helper if the orchestrator exposes one). Keep the in-memory cache. On ANY failure: THROW (do not fall back to fake vectors). DELETE `hashToEmbedding` entirely and remove its call sites. Keep `EMBEDDING_DIM` synced from the response length, not a constant, if it is only used for validation. |
| 4 | `supabase/migrations/20260925_qayyim_embedding_dim.sql` | Idempotent migration: `alter table public.qayyim_semantic_memory alter column embedding type vector(768)` guarded by a DO block checking current dimensions via `vector_dims(embedding)` (skip if already 768 or column missing); drop and recreate the HNSW index (same name as in foundation.sql :201-204) on the new column; `analyze`. Existing rows may hold 1536-dim garbage from the fake era — that data is worthless; the migration may truncate `qayyim_semantic_memory` BEFORE altering (add a comment stating why). |
| 5 | `lib/qayyim/memory/VectorStore.ts` | READ it. If it inserts embeddings bypassing `SharedMemory.generateEmbedding`, route it through `generateEmbedding`. If it already delegates, no change — state "no change" in your report. |

## New files

- `supabase/migrations/20260925_qayyim_embedding_dim.sql` (above).
- `tests/qayyim/seoEvidence.test.ts` — vitest: with `NEXT_PUBLIC_SITE_URL` unset, `auditSEO` returns success:false; with a stubbed global `fetch` returning a fixture HTML (title, 2 h1s, one img missing alt), the returned result's `data.evidence.title` matches the fixture and `imgsMissingAlt === 1`; an off-origin `params.url` is refused.

## Forbidden

- NO new npm packages; NO new API keys; NO paid embedding APIs.
- Do NOT call Gemini for anything except embeddings here (chat stays on the orchestrator).
- Do NOT let the LLM invent evidenceUrls — post-filters are mandatory, not optional.
- Do NOT keep any fallback that fabricates vectors.
- Do NOT touch `MasterOrchestrator.ts`, agents other than the two listed, or any route.

## Post-change verification

```bash
npm run typecheck && npm test -- tests/qayyim/seoEvidence.test.ts
# EXPECT: exit 0

grep -rn "hashToEmbedding" lib/
# EXPECT: no matches
```

Manual (state done/not-done): with env set, run an auditSEO against `/` on dev — result contains `evidence.fetchedUrl` and `evidence.h1s.length > 0`; two near-identical Arabic sentences embed with cosine ≥ 0.5 while an unrelated pair is < 0.3 (report measured values).

## Definition of Done

- [ ] Pre-flight 1-6 matched (env var name for Gemini cited from `lib/ai-orchestrator.ts`).
- [ ] SEO audit returns real fetched evidence; off-origin claims filtered.
- [ ] Visual checks only reference real DB-listed images.
- [ ] `generateEmbedding` throws on failure; zero fake-vector codepaths remain.
- [ ] Migration is idempotent and truncates stale 1536-dim rows with an explanatory comment.
- [ ] Verification loop green.

## Rollback

```bash
git revert <p1-commit>   # restores hashToEmbedding + old dimensions
# DB: apply a reverse migration only if the new migration was actually pushed (supabase db push). Local/dev only otherwise.
```

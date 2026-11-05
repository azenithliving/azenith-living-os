/**
 * Filling the six rooms the storefront advertises and the bank does not hold.
 *
 * Measured 2026-10-12: the home page shows sixteen rooms. Ten of them take their picture from the
 * store's own bank (8,077 active rows, all of them Pexels pulls scored by the same model that scores
 * this run). The other six — guest bedroom, home office, study, bathroom, guest bathroom, entrance
 * lobby — hold zero rows, so the page falls back to a live photo search with a random page offset in
 * it, and the same room wears a different picture on every visit.
 *
 * His own products are not a source: `products` holds ONE row and its `featured_image_url` is null
 * (counted 2026-10-12), so there is no downloaded work of the shop to pull from. This therefore uses
 * the same pipeline that built the other ten rooms — the same search provider, the same scorer, the
 * same acceptance bar of 85 — and writes the same kind of row.
 *
 * Brakes it keeps:
 *  - Nothing is written unless `--apply` is passed; the default run scores and reports only.
 *  - The row's id IS the provider's photo id, which is how the bank already keys itself, so a picture
 *    the bank holds can never be inserted twice.
 *  - A cell that gets no accepted picture is reported empty. It is not filled from another room.
 *  - The read-back counts what the database holds after the write, not what this script planned.
 *
 *   TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' \
 *   node -r ./scratch/load-env.cjs -r ./scratch/shim-server-only.cjs -r ts-node/register/transpile-only \
 *   -r tsconfig-paths/register scratch/harvest-room-covers.cts [--cells N] [--apply]
 */
import postgres from "postgres";

import { analyzeImageWithProxy } from "@/lib/gemini-proxy-client";

const APPLY = process.argv.includes("--apply");
const cellLimitArg = process.argv.indexOf("--cells");
const CELL_LIMIT = cellLimitArg > -1 ? Number(process.argv[cellLimitArg + 1]) : Infinity;

const STYLES = ["modern", "classic", "industrial", "scandinavian"];

/** The six rooms the storefront names and the bank does not hold, in the words the provider indexes. */
const ROOM_TERMS: Record<string, string> = {
  "guest-bedroom": "luxury guest bedroom hotel interior design",
  "home-office": "luxury home office study interior design",
  "study-room": "luxury study room library home office interior design",
  bathroom: "luxury marble bathroom hotel interior design",
  "guest-bathroom": "luxury guest powder bathroom marble interior design",
  "entrance-lobby": "luxury entrance lobby foyer villa interior design",
};

const STYLE_HINTS: Record<string, string> = {
  modern: "modern minimal",
  classic: "classic elegant",
  industrial: "industrial loft",
  scandinavian: "scandinavian cozy",
};

const PULL_PER_CELL = 20;
const KEEP_PER_CELL = 3;
const ACCEPT_AT = 85;
const WORKERS = 2;

const keys = (process.env.PEXELS_KEYS || "").split(",").map((k) => k.trim()).filter(Boolean);
if (!keys.length) throw new Error("PEXELS_KEYS فاضي — مفيش مصدر صور");

let keyCursor = 0;
const nextKey = () => keys[keyCursor++ % keys.length];

type Candidate = {
  id: number;
  url: string;
  thumb: string;
  room: string;
  style: string;
  width: number;
  height: number;
  score: number;
  reason: string;
};

async function pullCell(room: string, style: string): Promise<Candidate[]> {
  const query = `${STYLE_HINTS[style]} ${ROOM_TERMS[room]}`;
  const res = await fetch(`https://api.pexels.com/v1/search?${new URLSearchParams({ query, per_page: String(PULL_PER_CELL), size: "large" })}`, {
    headers: { Authorization: nextKey() },
  });
  if (!res.ok) {
    console.log(`  فشل البحث عن ${room}/${style}: ${res.status}`);
    return [];
  }
  const body = (await res.json()) as { photos?: Array<Record<string, any>> };
  return (body.photos ?? []).map((photo) => ({
    id: Number(photo.id),
    url: String(photo.src?.large ?? photo.src?.original ?? ""),
    thumb: String(photo.src?.medium ?? photo.src?.small ?? photo.src?.large ?? ""),
    room,
    style,
    width: Number(photo.width ?? 0),
    height: Number(photo.height ?? 0),
    score: 0,
    reason: "",
  }));
}

/** A small worker pool: the scorer takes ~4s an image, and the key army is 285 deep. */
async function scoreAll(items: Candidate[]): Promise<void> {
  let cursor = 0;
  let judged = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      try {
        const out = await analyzeImageWithProxy("", item.url, 0, item.room, item.style);
        item.score = Number((out as { score?: number }).score ?? 0);
        item.reason = String((out as { reason?: string }).reason ?? "");
      } catch {
        item.score = 0;
        item.reason = "المصحّح ما ردّش";
      }
      if (!item.score && cursor <= items.length) {
        await new Promise((r) => setTimeout(r, 4000));
        const again = await analyzeImageWithProxy("", item.url, 0, item.room, item.style).catch(() => null);
        if (again && Number((again as { score?: number }).score) > 0) {
          item.score = Number((again as { score: number }).score);
          item.reason = "اتعاد بعد فشل";
        }
      }
      judged += 1;
      if (judged % 12 === 0) console.log(`  مصحّح ${judged} من ${items.length}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(WORKERS, items.length) }, worker));
}

async function main() {
  const sql = postgres(process.env.DIRECT_URL as string, { ssl: "require", max: 2 });
  // Which cells the bank really holds pictures for — read, not assumed.
  const held = await sql`select room_type, style, count(*)::int n from public.curated_images
                         where is_active = true and room_type in ${sql(Object.keys(ROOM_TERMS))}
                         group by 1,2`;
  const full = new Set(held.filter((r) => r.n > 0).map((r) => `${r.room_type}/${r.style}`));
  const known = new Set((await sql`select id from public.curated_images`).map((r) => Number(r.id)));
  const wantedCells = Object.keys(ROOM_TERMS).length * STYLES.length;
  console.log(`البنك مليان في ${full.size} من ${wantedCells} خلية · وصوره المعروفة: ${known.size}`);
  const cells: Array<[string, string]> = [];
  for (const room of Object.keys(ROOM_TERMS))
    for (const style of STYLES) if (!full.has(`${room}/${style}`)) cells.push([room, style]);
  const chosen = cells.slice(0, Number.isFinite(CELL_LIMIT) ? CELL_LIMIT : cells.length);
  console.log(`خلايا: ${chosen.length} (من ${cells.length}) · بحث لكل خلية: ${PULL_PER_CELL} · القبول من ${ACCEPT_AT} · الكتابة: ${APPLY ? "أيوه" : "لأ (قياس بس)"}`);

  const candidates: Candidate[] = [];
  const seenIds = new Set<number>();
  for (const [room, style] of chosen) {
    // A picture the bank already files under another room cannot be filed twice: its id IS the
    // provider's photo id. Twenty rows were lost that way in the first run.
    const found = (await pullCell(room, style)).filter((c) => !known.has(c.id) && !seenIds.has(c.id));
    for (const c of found) seenIds.add(c.id);
    candidates.push(...found);
    console.log(`  ${room}/${style}: ${found.length} صورة من المزود`);
  }
  console.log(`\nمجموع المرشّحين: ${candidates.length} · بنطّحهم على المصحّح بـ ${WORKERS} عامل`);

  await scoreAll(candidates);

  const accepted = candidates.filter((c) => c.score >= ACCEPT_AT);
  console.log(`مقبول بدرجة ${ACCEPT_AT}+: ${accepted.length} من ${candidates.length}`);

  const byCell = new Map<string, Candidate[]>();
  for (const item of accepted) {
    const key = `${item.room}/${item.style}`;
    const list = byCell.get(key) ?? [];
    list.push(item);
    byCell.set(key, list);
  }
  const empty: string[] = [];
  for (const [room, style] of chosen) {
    const list = (byCell.get(`${room}/${style}`) ?? []).sort((a, b) => b.score - a.score).slice(0, KEEP_PER_CELL);
    if (!list.length) empty.push(`${room}/${style}`);
    byCell.set(`${room}/${style}`, list);
  }
  console.log(`خلايا فاضية (مفيش صورة بتستاهل): ${empty.length}${empty.length ? " — " + empty.slice(0, 8).join(" ، ") : ""}`);

  if (!APPLY) {
    console.log("\nده قياس بس. للكتابة زوّد علم الكتابة.");
    for (const [cell, list] of byCell) console.log(`  ${cell}: ${list.map((i) => `${i.id}(${i.score})`).join(" ") || "فاضي"}`);
    await sql.end();
    return;
  }

  let planned = 0;
  for (const list of byCell.values()) planned += list.length;
  for (const [cell, list] of byCell) {
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      await sql`
        insert into public.curated_images
          (id, url, thumbnail_url, original_url, style, room_type, quality_score, is_active, source, display_order, metadata)
        values
          (${item.id}, ${item.url}, ${item.thumb}, ${item.url}, ${item.style}, ${item.room}, ${item.score}, true, 'pexels', ${i},
           ${{ harvested_by: "room-cover-harvest-2026-10-12", ai_reason: item.reason, width: item.width, height: item.height }}::jsonb)
        on conflict (id) do nothing`;
    }
    console.log(`  كتبت ${list.length} في ${cell}`);
  }

  const back = await sql`
    select room_type, count(*)::int n, count(distinct style)::int styles
      from public.curated_images
     where is_active = true and room_type in ${sql(Object.keys(ROOM_TERMS))}
     group by 1 order by 1`;
  console.log(`\nبالقراية من القاعدة — خطّة ${planned} · اللي اتسجّل فعلاً:`);
  for (const r of back) console.log(`  ${r.room_type}: ${r.n} صورة في ${r.styles} طراز`);
  const missing = Object.keys(ROOM_TERMS).filter((room) => !back.some((r) => r.room_type === room));
  if (missing.length) console.log(`  لسه ملهاش حاجة: ${missing.join(" ، ")}`);
  await sql.end();
}

main().catch((e) => {
  console.error("فشل:", String(e).slice(0, 300));
  process.exit(1);
});

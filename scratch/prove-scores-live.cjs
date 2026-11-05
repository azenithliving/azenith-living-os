/**
 * The score column measured on the published site, not only in the database.
 *
 * Two questions, both answerable from outside: does the same paper give the same twenty pictures in the
 * same order every time (the defect was that with every score at 0.00 the order was whatever the
 * database felt like), and are those twenty the twenty the bank's own ranking puts on top? A customer's
 * chosen colours sit in front of the list, so the second test compares the set, and the first compares
 * the order the published door itself returns.
 *
 *   node scratch/prove-scores-live.mjs
 */
const dotenv = require("dotenv");
const path = require("path");
const postgres = require("postgres");

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const BASE = "https://azenith-living.vercel.app";
const TOKENS = ["5p8afiIWgQNG7hMSAaLoOr4h", "AQW-T6YVjqDGhwP7gKaO-1bw"];
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });

const door = async (token) => {
  const res = await fetch(`${BASE}/api/passport/${token}`, { cache: "no-store" });
  const body = await res.json();
  return { status: res.status, ok: Boolean(body.success), body };
};

(async () => {
  for (const token of TOKENS) {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const r = await door(token);
      if (!r.ok) {
        console.log(`token ${token.slice(0, 6)}: door said ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
        return;
      }
      runs.push(r.body);
    }
    const first = runs[0];
    const ids = first.images.map((i) => i.id);
    const same = runs.every((b) => b.images.map((i) => i.id).join(",") === ids.join(","));
    const type = first.images_room_type;

    // The picker does not hand the page its top twenty: it reads a sixty-row quality window plus a
    // style slice, then spreads the styles. So the set test is against the window it actually reads,
    // and the score test is against the type's best — measured, not assumed.
    const window = await sql`
      select id, quality_score
        from public.curated_images
       where room_type = ${type} and is_active and url is not null
       order by quality_score desc nulls last, display_order asc, id asc
       limit 60`;
    // The driver hands bigint ids back as strings; comparing them to the door's numbers without this
    // conversion measures nothing and says so with a clean zero.
    const windowIds = new Set(window.map((r) => Number(r.id)));
    const inside = ids.filter((id) => windowIds.has(Number(id))).length;
    const bestScore = window.length ? Number(window[0].quality_score) : null;
    const byId = new Map(window.map((r) => [Number(r.id), Number(r.quality_score)]));
    const doorScores = ids.map((id) => byId.get(Number(id)) ?? null).filter((v) => v !== null);

    console.log(`\nورقة ${token.slice(0, 6)} · نوع ${type} · مصدر الترتيب ${first.taste?.source}`);
    console.log(`  تلات طلبات متتالية على الرابط المنشور رجّعت نفس الترتيب بالظبط: ${same}`);
    console.log(`  الصور الـ${ids.length} اللي جبها الباب = ${inside} منها من نافذة البنك الستين الأعلى تقييماً`);
    console.log(`  أعلى درجة في النوع: ${bestScore} · درجات الصور عنده من ${Math.min(...doorScores)} لـ ${Math.max(...doorScores)} · وأول صورة درجتها ${doorScores[0]}`);
  }

  const shaped = await sql`
    select count(*)::int as rows,
           count(*) filter (where coalesce(quality_score,0) > 0) as scored
      from public.curated_images`;
  console.log(`\nالبنك: ${shaped[0].rows} سطر · المتدرج في العمود: ${shaped[0].scored}`);
})()
  .catch((e) => {
    console.error("live proof failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => sql.end());

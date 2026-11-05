/**
 * Is the taste station in the bundle the published elite page actually loads?
 *   node scratch/wait-elite-live.mjs [minutes]
 *
 * The chips live in a client component, so they never appear in the served HTML — only in the
 * script the page pulls. A walk that cannot reach step four is either a broken walk or an old
 * build, and the two need different fixes, so this settles which one it is before anyone clicks.
 */
const BASE = "https://azenith-living.vercel.app";
const MINUTES = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 12);
const deadline = Date.now() + MINUTES * 60_000;
const MARK = "data-elite-taste-chip";

async function probe() {
  const html = await fetch(`${BASE}/elite-brief`, { cache: "no-store" }).then((r) => r.text()).catch(() => "");
  const srcs = [...html.matchAll(/src="(\/_next\/[^"]+\.js)"/g)].map((m) => m[1]);
  let taste = 0;
  let area = 0;
  for (const src of srcs) {
    const body = await fetch(`${BASE}${src}`, { cache: "no-store" }).then((r) => r.text()).catch(() => "");
    if (body.includes(MARK)) taste++;
    if (body.includes("data-elite-area-chip")) area++;
  }
  return { scripts: srcs.length, taste, area };
}

for (;;) {
  const found = await probe();
  const fresh = found.taste > 0 && found.area > 0;
  console.log(
    `${new Date().toISOString().slice(11, 19)} · سكربتات=${found.scripts} · شارات الذوق=${found.taste} · شارات المنطقة=${found.area} · ${fresh ? "البناء الجديد منشور" : "لسه البناء القديم"}`,
  );
  if (fresh) process.exit(0);
  if (Date.now() > deadline) {
    console.log("انتهت المدة من غير ما تظهر الشارات — الآلة ما اتنفذتش.");
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 30_000));
}

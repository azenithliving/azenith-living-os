/**
 * Is the elite flow's own address in the bundle the published page loads?
 *   node scratch/wait-elite-address.mjs [minutes]
 *
 * The door's change is server-side and leaves no mark in the page, but the screen stating its own
 * address does — so this greps the scripts for that literal. A walk that reads back the old address
 * is either an old build or a broken writer, and the two need different fixes.
 */
const BASE = "https://azenith-living.vercel.app";
const MINUTES = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 12);
const MARK = /lastPage:\s*"\/elite-intelligence"/;
const deadline = Date.now() + MINUTES * 60_000;

async function probe() {
  const html = await fetch(`${BASE}/elite-intelligence`, { cache: "no-store" }).then((r) => r.text()).catch(() => "");
  const srcs = [...html.matchAll(/src="(\/_next\/[^"]+\.js)"/g)].map((m) => m[1]);
  let hits = 0;
  for (const src of srcs) {
    const body = await fetch(`${BASE}${src}`, { cache: "no-store" }).then((r) => r.text()).catch(() => "");
    if (MARK.test(body)) hits++;
  }
  return { scripts: srcs.length, hits };
}

for (;;) {
  const found = await probe();
  console.log(
    `${new Date().toISOString().slice(11, 19)} · سكربتات=${found.scripts} · فيه عنوان الشاشة=${found.hits} · ${found.hits ? "البناء الجديد منشور" : "لسه البناء القديم"}`,
  );
  if (found.hits) process.exit(0);
  if (Date.now() > deadline) {
    console.log("انتهت المدة من غير ما يظهر العنوان — الآلة ما اتنفذتش.");
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 30_000));
}

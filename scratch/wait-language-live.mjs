/**
 * Is the shared-language build live on the published elite flow?
 *   node scratch/wait-language-live.mjs [minutes]
 *
 * The marker is the brand line this atom moved onto the flow screen («أزينث — تجربة النخبة»):
 * before the fix it existed only on the brief screen, so finding it in the flow's own bundle proves
 * that bundle is the new one. The served HTML is a spinner (the page renders on the client), so
 * grepping the scripts is the only honest freshness check here.
 */
const BASE = "https://azenith-living.vercel.app";
const MINUTES = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 12);
const deadline = Date.now() + MINUTES * 60_000;
const MARK = "تجربة النخبة";

async function probe() {
  const html = await fetch(`${BASE}/elite-intelligence`, { cache: "no-store" }).then((r) => r.text()).catch(() => "");
  const srcs = [...html.matchAll(/src="(\/_next\/[^"]+\.js)"/g)].map((m) => m[1]);
  let hits = 0;
  for (const src of srcs) {
    const body = await fetch(`${BASE}${src}`, { cache: "no-store" }).then((r) => r.text()).catch(() => "");
    if (body.includes(MARK)) hits++;
  }
  return { scripts: srcs.length, hits };
}

for (;;) {
  const found = await probe();
  console.log(
    `${new Date().toISOString().slice(11, 19)} · سكربتات=${found.scripts} · السطر الجديد=${found.hits} · ${found.hits ? "البناء الجديد منشور" : "لسه البناء القديم"}`,
  );
  if (found.hits) process.exit(0);
  if (Date.now() > deadline) {
    console.log("انتهت المدة من غير ما يظهر السطر — البناء ما وصلش.");
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 30_000));
}

/**
 * Is the Arabic brief in the bundle the published page loads?
 *   node scratch/wait-elite-arabic.mjs [minutes]
 *
 * The screen sits behind Suspense and reads its language on the client, so the served HTML is only
 * a spinner — grepping it proves nothing either way. The words live in the script the page pulls,
 * so that is what this reads.
 */
const BASE = "https://azenith-living.vercel.app";
const MINUTES = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 12);
const deadline = Date.now() + MINUTES * 60_000;
const WORD = "صمم رؤيتك";
const ESCAPED = [...WORD].map((c) => `\\u${c.codePointAt(0).toString(16).padStart(4, "0")}`).join("");
const MARKS = [WORD, ESCAPED, "العودة للرئيسية"];

async function probe() {
  const html = await fetch(`${BASE}/elite-brief`, { cache: "no-store" }).then((r) => r.text()).catch(() => "");
  const srcs = [...html.matchAll(/src="(\/_next\/[^"]+\.js)"/g)].map((m) => m[1]);
  const found = new Set();
  for (const src of srcs) {
    const body = await fetch(`${BASE}${src}`, { cache: "no-store" }).then((r) => r.text()).catch(() => "");
    MARKS.forEach((mark, i) => body.includes(mark) && found.add(i));
  }
  return { scripts: srcs.length, hits: found.size };
}

for (;;) {
  const found = await probe();
  console.log(
    `${new Date().toISOString().slice(11, 19)} · سكربتات=${found.scripts} · علامات عربية=${found.hits} من ${MARKS.length} · ${found.hits ? "البناء الجديد منشور" : "لسه البناء القديم"}`,
  );
  if (found.hits) process.exit(0);
  if (Date.now() > deadline) {
    console.log("انتهت المدة من غير ما تظهر العلامات — الآلة ما اتنفذتش.");
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 30_000));
}

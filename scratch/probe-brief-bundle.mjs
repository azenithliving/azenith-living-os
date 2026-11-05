/**
 * Is the area chip in the bundle the published page actually loads?
 *   node scratch/probe-brief-bundle.mjs
 * The chip lives in a client component, so it never appears in the served HTML — only in the
 * script the page pulls. This greps those scripts, because a walk that cannot reach a step is
 * either a broken walk or an old build, and the two need different fixes.
 */
const html = await fetch("https://azenith-living.vercel.app/request", { cache: "no-store" }).then((r) => r.text());
const srcs = [...html.matchAll(/src="(\/_next\/[^"]+\.js)"/g)].map((m) => m[1]);
console.log(`عدد السكربتات: ${srcs.length}`);
let hit = 0;
for (const src of srcs) {
  const body = await fetch(`https://azenith-living.vercel.app${src}`, { cache: "no-store" }).then((r) => r.text()).catch(() => "");
  if (body.includes("data-lead-area")) { hit++; console.log(`   فيه الشارة: ${src.slice(0, 60)}…`); }
  if (body.includes("الساحل الشمالي") && body.includes("data-area-chip")) console.log(`   فيه شارات المنطقة: ${src.slice(0, 60)}…`);
}
console.log(hit ? "البناء الجديد منشور." : "مفيش سكربت فيه الشارة — البناء القديم لسه.");

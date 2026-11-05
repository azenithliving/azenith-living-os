/** Polls the published sheet until the new build answers with the area chips. */
const token = process.argv[2] || "AQW-T6YVjqDGhwP7gKaO-1bw";
const url = `https://azenith-living.vercel.app/passport/${token}`;
for (let i = 0; i < 20; i++) {
  const html = await fetch(url, { cache: "no-store" }).then((r) => r.text()).catch(() => "");
  const ready = html.includes("data-area-chip") || html.includes("منطقتك");
  console.log(`محاولة ${i + 1}: ${ready ? "البناء الجديد رد" : "لسه البناء القديم"}`);
  if (ready) process.exit(0);
  await new Promise((r) => setTimeout(r, 20000));
}
process.exit(1);

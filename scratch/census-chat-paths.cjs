const postgres = require("postgres");

/**
 * Which site addresses his chat prints as text.
 *
 * The chat turns any path it finds into a link and shows the path itself as the label — so a line
 * reads «…/rooms/living-room…» in Latin inside an Arabic sentence. Before choosing labels, count the
 * addresses that are actually there.
 */
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });

const PATH = /(?:^|[^A-Za-z0-9_/])(\/[A-Za-z0-9\-_.\/%]{2,})/g;

(async () => {
  const rows = await sql`select content from public.agent_messages where sender_type <> 'user' limit 3000`;
  const counts = new Map();
  for (const r of rows) {
    const text = String(r.content);
    let m;
    PATH.lastIndex = 0;
    while ((m = PATH.exec(text))) {
      const path = m[1].replace(/[).,؛،]+$/, "");
      counts.set(path, (counts.get(path) ?? 0) + 1);
    }
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  for (const [p, n] of sorted) console.log(`${n}\t${p}`);
  console.log(`مختلف: ${counts.size}`);
  await sql.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

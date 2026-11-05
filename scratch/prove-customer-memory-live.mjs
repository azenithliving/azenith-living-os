import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";
import postgres from "postgres";

/**
 * The customer memory, proved on his published site at his width — and refuted on a stranger.
 *
 * Six claims, each measured where it is supposed to show:
 *   ١) a paper he files, colours he picks and an area he types land under HIS key in the record;
 *   ٢) his next paper already knows him: his sheet reads «الدار فاكر: …» in his own digits;
 *   ٣) the owner's pre-call file carries a memory section that says what the shop knew before today;
 *   ٤) a customer with no history sees no such line and the file admits it — the negative is inside
 *      the same run, because a memory that shows for everyone is a template, not a memory;
 *   ٥) the instrument's own rows leave with it, and the table is counted back to what it was.
 *
 *   node scratch/prove-customer-memory-live.mjs
 */

const URL = "https://azenith-living.vercel.app";
const PHONE_HIM = "01000000008";
const PHONE_OTHER = "01000000009";
const KEY_HIM = "phone:1000000008";
const KEY_OTHER = "phone:1000000009";
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });
const checks = [];
const claim = (label, ok, detail = "") => {
  checks.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} · ${label}${detail ? ` · ${detail}` : ""}`);
};

const leftovers = await sql`delete from customer_memory where customer_key in (${KEY_HIM}, ${KEY_OTHER}) returning id`;
if (leftovers.length) console.log(`sources · cleared ${leftovers.length} row left by an earlier run`);
const before = (await sql`select count(*)::int as n from customer_memory`)[0].n;
console.log(`sources · customer_memory before = ${before}`);

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 130)));
page.on("pageerror", (e) => errors.push(String(e).slice(0, 130)));

async function filePaper(phone) {
  const res = await page.request.post(`${URL}/api/sheet`, { data: { image: PNG, phone }, headers: { "content-type": "application/json" } });
  const body = await res.json();
  return { status: res.status(), token: String(body?.passport_path ?? "").split("/").pop() ?? "" };
}

// ١) his first paper: colours and an area, all from his own hands
const first = await filePaper(PHONE_HIM);
claim("his first paper got its address", first.status === 200 && first.token.length >= 20, `token=${first.token.slice(0, 4)}…`);

const offered = await (await page.request.get(`${URL}/api/passport/${first.token}`)).json();
const matrix = offered?.sheet?.colour_matrix ?? [];
const twoFamilies = matrix.slice(0, 2).map((entry) => ({ family: entry.family, hex: entry.hexes?.[0] ?? entry.hex ?? "#cccccc" }));
console.log(`sources · the bank offered him ${matrix.length} families; he will pick ${twoFamilies.length}`);
if (twoFamilies.length < 2) {
  console.log("REFUSING: the bank offered fewer than two colour families — nothing to prove with.");
  process.exit(1);
}

const picked = await page.request.post(`${URL}/api/passport/${first.token}/colours`, {
  data: { picks: twoFamilies },
  headers: { "content-type": "application/json" },
});
claim("he picked two colours on his sheet", picked.status() === 200, `status=${picked.status()}`);

const contacted = await page.request.post(`${URL}/api/passport/${first.token}/contact`, {
  data: { phone: PHONE_HIM, city: "التجمع", room: "غرف المعيشة" },
  headers: { "content-type": "application/json" },
});
claim("he left his number and his area", contacted.status() === 200, `status=${contacted.status()}`);

const stored = await sql`
  select kind, value, source, evidence from customer_memory
  where customer_key = ${KEY_HIM} order by kind, value`;
console.log(`sources · the record holds ${stored.length} facts about him:`);
for (const s of stored) console.log(`   · ${s.kind} = ${s.value} · ${s.source}${s.evidence ? ` · ${s.evidence}` : ""}`);
claim("his colours, his area and his room are stored under his own key", stored.length >= 4 && stored.some((s) => s.kind === "colour") && stored.some((s) => s.kind === "area") && stored.some((s) => s.kind === "room"), `rows=${stored.length}`);

// ٢) his next paper already knows him
const second = await filePaper(PHONE_HIM);
await page.goto(`${URL}/passport/${second.token}`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(6000);
const sheetText = await page.locator("body").innerText();
const memoryNode = await page.locator("[data-customer-memory]").count();
const memoryShown = (await page.locator("[data-customer-memory]").first().innerText().catch(() => "")) ?? "";
claim("his new sheet says what the shop remembers", memoryNode === 1 && /الدار فاكر/.test(memoryShown), memoryShown.slice(0, 90));
claim("and the remembered words are his own", /التجمع/.test(memoryShown) && /(رمادي|بيج|أوف وايت|بني|أخضر|أبيض|توبي|فحمي|كاراميل)/.test(memoryShown), memoryShown.slice(0, 60));
await page.locator("[data-customer-memory]").scrollIntoViewIfNeeded();
await page.waitForTimeout(1200);
await page.locator("[data-customer-memory]").screenshot({ path: "scratch/memory-his-second-sheet-390.png" });

// ٤) the negative: another man with no history sees nothing of his
const stranger = await filePaper(PHONE_OTHER);
await page.goto(`${URL}/passport/${stranger.token}`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(5000);
const strangerMemory = await page.locator("[data-customer-memory]").count();
const strangerText = await page.locator("body").innerText();
// His area name appears on every sheet as a chip he may choose — the memory claim is the block, not
// the word. So the negative reads the block and the sentence, never a bare substring.
claim("a customer with no history is NOT shown anyone else's memory", strangerMemory === 0 && !strangerText.includes("الدار فاكر"), `block=${strangerMemory}`);
const strangerRows = await sql`select count(*)::int as n from customer_memory where customer_key = ${KEY_OTHER}`;
claim("and nothing was written under his key either", strangerRows[0].n === 0, `rows=${strangerRows[0].n}`);
await page.screenshot({ path: "scratch/memory-stranger-sheet-390.png" });

// ٣) the owner's pre-call file
const owner = await ctx.newPage();
owner.on("console", (m) => m.type() === "error" && errors.push("owner: " + m.text().slice(0, 130)));
await owner.goto(`${URL}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await owner.waitForTimeout(4000);
await owner.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await owner.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await owner.click("button[type=submit]");
await owner.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await owner.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await owner.click("button[type=submit]");
for (let i = 0; i < 20 && !owner.url().includes("/admin"); i += 1) await owner.waitForTimeout(2000);
claim("the gate still lets its owner in", owner.url().includes("/admin"), `landed on ${owner.url().replace(URL, "")}`);

const dossier = await owner.request.get(`${URL}/api/admin/customers/dossier?customer_key=${encodeURIComponent(KEY_HIM)}`);
const file = await dossier.json();
const memorySection = (file?.sections ?? []).find((s) => s.id === "memory");
claim("the pre-call file carries a memory section for him", dossier.status() === 200 && Boolean(memorySection) && memorySection.facts.length > 0, `facts=${memorySection?.facts?.length ?? 0}`);
console.log(`sources · what the file shows the owner: ${(memorySection?.facts ?? []).map((f) => `${f.label} ${f.value}`).join(" · ")}`);
claim("and every line names where it came from", (memorySection?.facts ?? []).every((f) => typeof f.source === "string" && f.source.length > 3));

const otherFile = await (await owner.request.get(`${URL}/api/admin/customers/dossier?customer_key=${encodeURIComponent(KEY_OTHER)}`)).json();
const otherSection = (otherFile?.sections ?? []).find((s) => s.id === "memory");
claim("for the man with no history the file says so instead of inventing", otherSection && otherSection.facts.length === 0 && (otherSection.missing ?? []).join(" ").includes("أول مرة"), JSON.stringify(otherSection?.missing ?? []));

await owner.goto(`${URL}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 90000 });
await owner.waitForTimeout(6000);
await owner.screenshot({ path: "scratch/memory-sales-screen-390.png" });

// ٥) the instrument's own rows leave with it
const erasedPapers = await sql`delete from room_sketches where customer_key in (${KEY_HIM}, ${KEY_OTHER}) returning id`;
const erasedMemory = await sql`delete from customer_memory where customer_key in (${KEY_HIM}, ${KEY_OTHER}) returning id`;
const after = (await sql`select count(*)::int as n from customer_memory`)[0].n;
console.log(`sources · papers removed=${erasedPapers.length} · memory rows removed=${erasedMemory.length}`);
claim("the store's memory table is counted back to what it was", after === before, `before=${before} after=${after}`);

console.log(`\n== الكونسول (${errors.length}) ==`);
for (const e of [...new Set(errors)].slice(0, 10)) console.log(`· ${e}`);

const failed = checks.filter((c) => !c).length;
console.log(`\n== الخلاصة ==\n${checks.length - failed} راجع من ${checks.length} قياس · فاشل ${failed} · أخطاء متصفح ${errors.length}`);
await b.close();
await sql.end();
process.exit(failed || errors.length ? 1 : 0);

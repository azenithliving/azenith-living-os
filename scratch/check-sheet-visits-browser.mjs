import fs from "node:fs";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * The customer's own phone, at his width: does the sheet still open with the visit label attached,
 * and does the store keep exactly one visit for it?
 *   node scratch/check-sheet-visits-browser.mjs [base]
 *
 * The counter is arithmetic on the server, but the label is born in a browser, and a page that
 * threw over it would cost the customer his sheet. So this is opened the way he opens it — one
 * phone-sized window, the real door, the real storage — and looked at. The throwaway sheet is
 * removed at the end.
 */
const BASE = process.argv[2] || "http://127.0.0.1:3223";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const token = ("brwproof" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 24);
const { data: sheet, error: insertError } = await supabase
  .from("room_sketches")
  .insert({ token, room: "living-room", customer_city: "تجربة", image_path: "/placeholder-room.jpg", ok: true })
  .select("id")
  .single();
if (insertError || !sheet) {
  console.log("could not create the throwaway sheet:", JSON.stringify(insertError));
  process.exit(1);
}

const errors = [];
let failed = false;
const say = (label, ok, detail = "") => {
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

try {
  await page.goto(`${BASE}/passport/${token}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const heading = (await page.locator("h1").first().innerText()).trim();
  // Arabic script is required, not merely a non-empty heading: on a Vercel-locked deployment URL the
  // page answers «Log in to Vercel» and a weaker check would have called that a working sheet.
  say("the sheet opens at his width", /\p{Script=Arabic}/u.test(heading) && !heading.includes("undefined"), `«${heading}»`);

  const stored = await page.evaluate(() => window.localStorage.getItem("azenith-visit-key") ?? "");
  say("the phone kept its own label", /^[A-Za-z0-9_-]{8,40}$/.test(stored), `length ${stored.length}`);

  let visits = await supabase.from("sheet_visits").select("device_key,visit_count").eq("sketch_id", sheet.id);
  const rows = visits.data ?? [];
  say("the store kept one visit for that one open", rows.length === 1 && Number(rows[0].visit_count) === 1, JSON.stringify(rows));
  say("the label the store holds is the one the phone holds", rows[0]?.device_key === stored);

  // Reload: the same phone, minutes apart, must not look like a customer coming back.
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  visits = await supabase.from("sheet_visits").select("device_key,visit_count").eq("sketch_id", sheet.id);
  const after = visits.data ?? [];
  say("a reload is not a return", after.length === 1 && Number(after[0].visit_count) === 1, JSON.stringify(after));

  const same = await page.evaluate(() => window.localStorage.getItem("azenith-visit-key") ?? "");
  say("the reload reused the label instead of minting a new one", same === stored);

  say("nothing threw in his browser", errors.length === 0, errors.slice(0, 3).join(" | "));
  await page.screenshot({ path: "scratch/sheet-visits-phone.png", fullPage: false });
  console.log("screenshot: scratch/sheet-visits-phone.png");
} finally {
  await browser.close();
  await supabase.from("room_sketches").delete().eq("id", sheet.id);
  const left = await supabase.from("room_sketches").select("id").eq("id", sheet.id).maybeSingle();
  const leftVisits = await supabase.from("sheet_visits").select("device_key").eq("sketch_id", sheet.id);
  say("the throwaway sheet and its visit rows are gone", !left.data && (leftVisits.data ?? []).length === 0);
  if (failed) process.exitCode = 1;
}

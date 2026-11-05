import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * Proves the third heat proof on the live store: a phone opens the sheet, the store keeps one visit
 * per half-hour window, a stranger's request writes nothing, and once the returns pass three the
 * votes desk wakes the owner from the counter alone — no paper raised, no link shared.
 *   node scratch/prove-sheet-visits.mjs [base]
 *
 * The sheet this script creates is its own, with a city nobody ordered: «تجربة». It is removed at
 * the end, and nothing of the owner's is written. The service key is read from the environment and
 * never printed.
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

const token = ("visproof" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 24);
const PHONE_A = "proofdeviceaaaaaaaaaaaa";
const PHONE_B = "proofdevicebbbbbbbbbbbb";

const { data: sheet, error: insertError } = await supabase
  .from("room_sketches")
  .insert({
    token,
    room: "living-room",
    customer_city: "تجربة",
    image_path: "/placeholder-room.jpg",
    ok: true,
  })
  .select("id")
  .single();

if (insertError || !sheet) {
  console.log("could not create the throwaway sheet:", JSON.stringify(insertError));
  process.exit(1);
}
console.log("throwaway sheet created:", Boolean(sheet.id));

const openSheet = async (key) => {
  const res = await fetch(`${BASE}/api/passport/${token}`, key ? { headers: { "x-visit-key": key } } : undefined);
  return res.status;
};

const rows = async () => {
  const { data } = await supabase.from("sheet_visits").select("device_key,visit_count,last_seen_at").eq("sketch_id", sheet.id);
  return data ?? [];
};

/** The door's own arithmetic: each device's first open is not a return. */
const returnsOf = (list) => list.reduce((sum, r) => sum + Math.max(0, Number(r.visit_count) - 1), 0);

const backdate = async (key, minutes) => {
  const when = new Date(Date.now() - minutes * 60_000).toISOString();
  await supabase.from("sheet_visits").update({ last_seen_at: when }).eq("sketch_id", sheet.id).eq("device_key", key);
};

const checks = {};
let failed = false;
const say = (label, ok, detail = "") => {
  checks[label] = ok;
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

try {
  say("sheet read answers 200", (await openSheet(PHONE_A)) === 200);

  let list = await rows();
  say("first open stored one visit", list.length === 1 && Number(list[0].visit_count) === 1, JSON.stringify(list));

  await openSheet(PHONE_A);
  await openSheet(PHONE_A);
  list = await rows();
  say("two refreshes inside the window are still one visit", Number(list[0]?.visit_count) === 1, `count ${list[0]?.visit_count}`);

  await openSheet(null);
  list = await rows();
  say("a request with no label invents no visit", list.length === 1, `${list.length} rows`);

  await backdate(PHONE_A, 40);
  await openSheet(PHONE_A);
  list = await rows();
  say("the same eyes back after half an hour count a return", Number(list[0]?.visit_count) === 2, `count ${list[0]?.visit_count}`);

  await openSheet(PHONE_B);
  list = await rows();
  say("a second device starts at one visit of its own", list.length === 2, `${list.length} rows`);
  say("the sheet's returns are the sum minus each first open", returnsOf(list) === 1, `returns ${returnsOf(list)}`);

  // Drive the first device past the rule's ceiling, then let the votes desk decide on its own.
  for (let i = 0; i < 3; i += 1) {
    await backdate(PHONE_A, 40);
    await openSheet(PHONE_A);
  }
  list = await rows();
  const returns = returnsOf(list);
  say("the counter reaches four returns", returns === 4, `returns ${returns}`);

  const before = await supabase.from("room_sketches").select("pulse_sent_at,plan").eq("id", sheet.id).single();
  say("the paper carries no drawing, so only the returns can make it hot", !before.data?.pulse_sent_at && !before.data?.plan);

  const voted = await fetch(`${BASE}/api/passport/${token}/votes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image_key: "img-proof", voter: "أنا", liked: true }),
  });
  say("the single voter's tap was accepted", voted.status === 200, `status ${voted.status}`);

  const after = await supabase.from("room_sketches").select("pulse_sent_at").eq("id", sheet.id).single();
  say("the returns alone woke the owner", Boolean(after.data?.pulse_sent_at), `stamp ${after.data?.pulse_sent_at}`);
} finally {
  await supabase.from("room_sketches").delete().eq("id", sheet.id);
  const leftSheet = await supabase.from("room_sketches").select("id").eq("id", sheet.id).maybeSingle();
  const leftVisits = await supabase.from("sheet_visits").select("device_key").eq("sketch_id", sheet.id);
  say("the throwaway sheet and its visit rows are gone", !leftSheet.data && (leftVisits.data ?? []).length === 0);
  console.log("verdict:", JSON.stringify(checks));
  if (failed) process.exitCode = 1;
}

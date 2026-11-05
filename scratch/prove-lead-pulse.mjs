import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * Proves the golden moment end to end on a throwaway sheet: two family members vote, the store
 * decides the customer is hot, the messenger is asked, and the sheet carries the stamp.
 *   node scratch/prove-lead-pulse.mjs [base]
 *
 * The row this script creates is its own — a sheet with a token nobody was given — and it is
 * removed at the end. Nothing of the owner's is written or deleted. The bot token and the service
 * key are read from the environment and never printed.
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

// The door checks the shape before it looks anything up: 20-32 characters of a small alphabet.
const token = ("pulseproof" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 24);
const { data: sheet, error: insertError } = await supabase
  .from("room_sketches")
  .insert({
    token,
    room: "living-room",
    customer_city: "التجمع",
    customer_key: "pulse-proof-" + token.slice(0, 10),
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

const vote = async (voter) => {
  const r = await fetch(`${BASE}/api/passport/${token}/votes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image_key: "img-proof", voter, liked: true }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

try {
  const first = await vote("أنا");
  const mid = await supabase.from("room_sketches").select("pulse_sent_at").eq("id", sheet.id).single();
  console.log("vote 1:", first.status, "· stamped after one voter:", Boolean(mid.data?.pulse_sent_at));

  const second = await vote("مراتي");
  const after = await supabase.from("room_sketches").select("pulse_sent_at").eq("id", sheet.id).single();
  console.log("vote 2:", second.status, "· people on the sheet:", JSON.stringify(second.body?.people));
  console.log("stamped after the second voter:", Boolean(after.data?.pulse_sent_at));

  const third = await vote("أحمد");
  const still = await supabase.from("room_sketches").select("pulse_sent_at").eq("id", sheet.id).single();
  console.log("vote 3 did not stamp twice:", String(still.data?.pulse_sent_at) === String(after.data?.pulse_sent_at));

  const verdict = {
    votesAccepted: first.status === 200 && second.status === 200,
    pulseStampedOnce: Boolean(after.data?.pulse_sent_at) && String(still.data?.pulse_sent_at) === String(after.data?.pulse_sent_at),
  };
  console.log("verdict:", JSON.stringify(verdict));
  console.log(
    "note: the stamp is written only when the messenger accepted the message — a false stamp would silence the next real signal."
  );
} finally {
  const { error: cleanError } = await supabase.from("room_sketches").delete().eq("id", sheet.id);
  const { data: left } = await supabase.from("room_sketches").select("id").eq("id", sheet.id).maybeSingle();
  console.log("throwaway sheet removed:", !left, cleanError ? JSON.stringify(cleanError) : "");
}

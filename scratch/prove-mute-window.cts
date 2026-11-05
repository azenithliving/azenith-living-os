/**
 * The mute window, measured on the live store as an A/B on one condition.
 *
 * The claim to test is not "a unit function adds 24 hours" — it is that a condition the owner reviewed
 * stops being re-written while the window is open, and starts being written again the moment it
 * closes, with no row deleted and nothing hidden from the screen in between.
 *
 * It runs against the real watcher and the real log: baseline reading, then the same reading with the
 * mute live, then the same reading with the mute past its deadline. The sighting count is the
 * instrument — it rises on every reading that is allowed to write, and must hold still while muted.
 *
 *   TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' \
 *   node -r ./scratch/load-env.cjs -r ./scratch/shim-server-only.cjs \
 *        -r ts-node/register/transpile-only -r tsconfig-paths/register scratch/prove-mute-window.cts
 */
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSystemHealth, getPendingAlerts } from "@/lib/sentinel";
import { muteUntilFrom } from "@/lib/sentinel-report";

const KEY = "api:xai";

async function sighting(): Promise<{ occurrences: number | null; note: string; id: string | null }> {
  const health = await getSystemHealth();
  const pending = await getPendingAlerts();
  const alert = pending.find((row) => row.category === "api") ?? null;
  return { occurrences: alert?.occurrences ?? null, note: health.logNote, id: alert?.id ?? null };
}

async function main(): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    console.error("no database client — nothing measured");
    return;
  }

  const before = await sighting();
  console.log(`baseline: occurrences = ${before.occurrences} · note = ${before.note}`);
  if (!before.id || before.occurrences === null) {
    console.error("the condition is not in the log — the test needs it present");
    return;
  }

  // Open the window exactly the way the review button does.
  const until = muteUntilFrom(new Date());
  const inserted = await supabase
    .from("system_alert_mutes")
    .upsert({ dedupe_key: KEY, alert_id: before.id, muted_until: until }, { onConflict: "dedupe_key" });
  console.log(`mute opened until ${until} — error = ${inserted.error?.message ?? "none"}`);

  const muted = await sighting();
  console.log(`while muted: occurrences = ${muted.occurrences} · note = ${muted.note}`);

  // Run the same row's clock past its deadline. Nothing is deleted; the row simply stops covering.
  const past = new Date(Date.now() - 60_000).toISOString();
  const aged = await supabase.from("system_alert_mutes").update({ muted_until: past }).eq("dedupe_key", KEY);
  console.log(`mute aged to ${past} — error = ${aged.error?.message ?? "none"}`);

  const after = await sighting();
  console.log(`after the window: occurrences = ${after.occurrences} · note = ${after.note}`);

  const blocked = muted.occurrences === before.occurrences;
  const resumed = after.occurrences === (before.occurrences ?? 0) + 1;
  const shownWhileMuted = muted.note.includes("مكتوم");
  const hiddenAfter = !after.note.includes("مكتوم");

  console.log(`\nverdict: blocked while muted = ${blocked} · recorded again after the window = ${resumed}`);
  console.log(`         named on screen while muted = ${shownWhileMuted} · quiet again after = ${hiddenAfter}`);
  console.log(`         alert stayed visible in the list the whole time = ${Boolean(muted.id && after.id)}`);
}

void main();

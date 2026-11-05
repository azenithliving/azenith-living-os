import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * What colours is the store's picture bank actually made of — and would a palette grouped into
 * named families say anything a customer could use, or just repeat twenty near-identical hexes?
 *
 * Reads the same rows the sheet reads (the best of a room type, quality first) and prints the
 * family counts. Nothing is invented here: a colour that is not in the bank is not in the report.
 */
const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function hexToHsl(hex: string) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  if (!m) return null;
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l: Math.round(l * 100) };
  const hRaw =
    max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const h = Math.round(((hRaw * 60) + 360) % 360);
  const s = Math.round((d / (1 - Math.abs(2 * l - 1))) * 100);
  return { h, s, l };
}

async function main() {
  for (const room of ["living-room", "master-bedroom", "dining-room"]) {
    const { data, error } = await supabase
      .from("curated_images")
      .select("metadata,quality_score")
      .eq("room_type", room)
      .eq("is_active", true)
      .order("quality_score", { ascending: false, nullsFirst: false })
      .limit(20);
    if (error) {
      console.log(room, "refused:", String(error.message).slice(0, 80));
      continue;
    }
    const colors = (data ?? []).map((r: any) => r?.metadata?.avg_color).filter(Boolean);
    const uniq = [...new Set(colors.map(String))];
    console.log(`\n${room}: ${colors.length} pictures, ${uniq.length} distinct colours`);
    for (const hex of uniq.slice(0, 24)) {
      const hsl = hexToHsl(String(hex));
      console.log(`  ${hex}  h=${hsl?.h} s=${hsl?.s} l=${hsl?.l}`);
    }
  }

  // The whole bank: how many distinct colours, and how far apart are the nearest neighbours?
  const all: string[] = [];
  for (let from = 0; from < 600; from += 200) {
    const { data } = await supabase
      .from("curated_images")
      .select("metadata")
      .eq("is_active", true)
      .not("url", "is", null)
      .range(from, from + 199);
    for (const row of data ?? []) {
      const c = (row as any)?.metadata?.avg_color;
      if (typeof c === "string") all.push(c);
    }
  }
  const seen = new Map<string, number>();
  for (const hex of all) {
    const hsl = hexToHsl(hex);
    if (!hsl) continue;
    const bucket = `${Math.round(hsl.h / 15) * 15}|${Math.round(hsl.s / 20) * 20}|${Math.round(hsl.l / 15) * 15}`;
    seen.set(bucket, (seen.get(bucket) ?? 0) + 1);
  }
  console.log(`\nbank sample: ${all.length} colours, ${new Set(all).size} distinct, ${seen.size} coarse buckets`);
  console.log("top buckets (hue|sat|light → count):");
  for (const [bucket, count] of [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${bucket} → ${count}`);
  }
  process.exit(0);
}

void main();

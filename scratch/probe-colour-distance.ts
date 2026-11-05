import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { hexToRgb, familyOf } from "../lib/cad/palette";

/**
 * How far apart the bank's own pictures really are, so the line between «قريبة من اختيارك» and
 * «not» is measured instead of picked. Prints, for each of a room's shown pictures, the distance
 * from the colour a customer would most likely stop on.
 */
const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function main() {
  for (const room of ["living-room", "master-bedroom"]) {
    const { data } = await supabase
      .from("curated_images")
      .select("metadata")
      .eq("room_type", room)
      .eq("is_active", true)
      .order("quality_score", { ascending: false, nullsFirst: false })
      .limit(20);
    const hexes = (data ?? []).map((r: any) => r?.metadata?.avg_color).filter(Boolean);
    const families = new Map<string, string[]>();
    for (const hex of hexes) {
      const f = familyOf(hex);
      if (!f) continue;
      families.set(f, [...(families.get(f) ?? []), hex]);
    }
    console.log(`\n${room}: ${hexes.length} pictures, ${families.size} families`);
    for (const [family, list] of families) {
      const anchor = list[0]!;
      const a = hexToRgb(anchor)!;
      const distances = hexes
        .map((hex: string) => {
          const c = hexToRgb(hex)!;
          return Math.round(Math.hypot(c.r - a.r, c.g - a.g, c.b - a.b));
        })
        .sort((x: number, y: number) => x - y);
      console.log(`  ${family} (${list.length}) anchor ${anchor}: nearest distances ${distances.slice(0, 10).join(",")} · median ${distances[Math.floor(distances.length / 2)]}`);
    }
  }
  process.exit(0);
}

void main();

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * How the store's whole picture bank distributes over colour families, measured rather than
 * assumed. Every colour here comes out of a row the bank actually holds; nothing is offered to a
 * customer that the bank cannot back with pictures.
 *
 * The families are named by the numbers they hold, so the honest answer to «what colours do you
 * have?» is a count per family, not a mood word.
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
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i]!, 16) / 255);
  const max = Math.max(r!, g!, b!);
  const min = Math.min(r!, g!, b!);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const hRaw = max === r ? ((g! - b!) / d) % 6 : max === g ? (b! - r!) / d + 2 : (r! - g!) / d + 4;
  return { h: (((hRaw * 60) + 360) % 360) / 360, s: d / (1 - Math.abs(2 * l - 1)), l };
}

/** The family a colour belongs to — the same rule the store will offer on a sheet. */
function familyOf(hsl: { h: number; s: number; l: number }): string {
  const hue = hsl.h * 360;
  if (hsl.s < 0.08) return hsl.l > 0.72 ? "أبيض مطفي" : hsl.l < 0.3 ? "فحمي" : "رمادي";
  if (hsl.s < 0.18 && hsl.l > 0.6) return "أوف وايت";
  if (hue >= 15 && hue <= 45) {
    if (hsl.l < 0.3) return "بني غامق";
    if (hsl.l < 0.45) return "بني خشبي";
    if (hsl.s < 0.25) return "بيج دافئ";
    return "كاراميل";
  }
  if (hue < 15 || hue > 330) return "توبي/نوبي";
  if (hue > 150 && hue < 260) return "أزرق";
  if (hue >= 60 && hue <= 150) return "أخضر";
  return "لون تاني";
}

async function main() {
  const colours: string[] = [];
  for (let from = 0; from < 6000; from += 500) {
    const { data, error } = await supabase
      .from("curated_images")
      .select("metadata")
      .eq("is_active", true)
      .not("url", "is", null)
      .range(from, from + 499);
    if (error) {
      console.log("read refused:", String(error.message).slice(0, 90));
      break;
    }
    if (!data?.length) break;
    for (const row of data) {
      const c = (row as any)?.metadata?.avg_color;
      if (typeof c === "string") colours.push(c);
    }
  }

  const families = new Map<string, { n: number; sum: { h: number; s: number; l: number } }>();
  for (const hex of colours) {
    const hsl = hexToHsl(hex);
    if (!hsl) continue;
    const name = familyOf(hsl);
    const entry = families.get(name) ?? { n: 0, sum: { h: 0, s: 0, l: 0 } };
    entry.n += 1;
    entry.sum.h += hsl.h;
    entry.sum.s += hsl.s;
    entry.sum.l += hsl.l;
    families.set(name, entry);
  }

  console.log(`pictures with a colour: ${colours.length}`);
  const ordered = [...families.entries()].sort((a, b) => b[1].n - a[1].n);
  for (const [name, entry] of ordered) {
    const avg = { h: entry.sum.h / entry.n / 360, s: entry.sum.s / entry.n, l: entry.sum.l / entry.n };
    console.log(`  ${name}: ${entry.n} (${Math.round((entry.n / colours.length) * 100)}%)  average h=${Math.round(avg.h * 360)} s=${Math.round(avg.s * 100)} l=${Math.round(avg.l * 100)}`);
  }
  process.exit(0);
}

void main();

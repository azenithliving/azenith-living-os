/**
 * Where a room gets its Arabic name, and which copies disagree with the catalog — the owner
 * (`lib/rooms-catalog.ts`) is asked for every key the other surfaces spell.
 *   TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' \
 *   node -r ts-node/register/transpile-only -r tsconfig-paths/register scratch/census-room-namers.cts
 */
import { readFileSync } from "node:fs";
import { roomNameAr, VALID_ROOM_SLUGS } from "@/lib/rooms-catalog";

type Pair = { surface: string; key: string; arabic: string };

function pairsFrom(surface: string, source: string, re: RegExp, gk = 1, ga = 2): Pair[] {
  const out: Pair[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) out.push({ surface, key: m[gk], arabic: m[ga] });
  return out;
}

const roomPage = readFileSync("app/rooms/[slug]/page.tsx", "utf8");
const siteContent = readFileSync("lib/site-content.ts", "utf8");
const requestPage = readFileSync("components/request-page-client.tsx", "utf8");
const seo = readFileSync("lib/seo.ts", "utf8");

/** Only the room list of the request form — the file has four other label lists that name things. */
const spaces = requestPage.slice(requestPage.indexOf("const SPACES"), requestPage.indexOf("];", requestPage.indexOf("const SPACES")));
/** Only the room sections of the content file — the rest of it names products and landing pages. */
const sections = siteContent.slice(0, siteContent.indexOf("export const PRODUCTS") || siteContent.length);

const pairs: Pair[] = [
  ...pairsFrom("rooms page", roomPage, /id:\s*"([a-z-]+)",\s*\n\s*title:\s*"([^"]+)"/g),
  ...pairsFrom("site content", sections, /slug:\s*"([a-z-]+)",[\s\S]{0,200}?title:\s*"([^"]+)"/g),
  ...pairsFrom("request form", spaces, /value:\s*"([a-z_]+)",\s*labelAr:\s*"([^"]+)"/g),
  ...pairsFrom("seo titles", seo, /"([a-z-]+)":\s*\{\s*title:\s*"([^"]+)"/g),
];

const bySurface = new Map<string, number>();
for (const p of pairs) bySurface.set(p.surface, (bySurface.get(p.surface) ?? 0) + 1);
console.log(`names read: ${pairs.length} — ${[...bySurface.entries()].map(([s, n]) => `${s}=${n}`).join(", ")}`);
console.log(`catalog keys: ${VALID_ROOM_SLUGS.length}\n`);

let answered = 0;
let silent = 0;
let disagree: Pair[] = [];
for (const p of pairs) {
  const owner = roomNameAr(p.key);
  if (!owner) {
    silent += 1;
    console.log(`  بلا إجابة من صاحب الاسم: [${p.surface}] ${p.key} → «${p.arabic}»`);
    continue;
  }
  answered += 1;
  if (owner !== p.arabic) disagree.push({ ...p, arabic: `${p.arabic}  ≠  ${owner}` });
}
console.log(`\nthe catalog answers ${answered} of ${pairs.length} names (${silent} it has no key for)`);
console.log(`disagreements: ${disagree.length}`);
for (const d of disagree) console.log(`  [${d.surface}] ${d.key}: ${d.arabic}`);

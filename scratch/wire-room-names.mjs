import { readFileSync, writeFileSync } from "node:fs";
import { roomNameAr, VALID_ROOM_SLUG_LIST } from "../lib/rooms-catalog.ts";

/**
 * One room, one Arabic name: the two surfaces that spell a room's name get it from the owner
 * instead of carrying their own copy. The English titles and the prose stay where they are —
 * the English values are what the stored rows and the scoring rules compare against.
 */
const FILES = ["app/rooms/[slug]/page.tsx", "lib/site-content.ts"];

for (const file of FILES) {
  const source = readFileSync(file, "utf8");
  let changed = 0;
  const out = source.replace(
    /((?:id|slug):\s*")([a-z-]+)(",\s*\n\s*title:\s*)"([^"]+)"/g,
    (_all, a, key, b, literal) => {
      const owner = roomNameAr(key);
      if (!owner) {
        console.log(`  ${file}: ${key} — صاحب الاسم ما يعرفوش، السطر سايب زي هو`);
        return `${a}${key}${b}"${literal}"`;
      }
      if (owner === literal) {
        // Same words today, still one owner: a copy that agrees is a copy that can drift.
        changed += 1;
        return `${a}${key}${b}roomNameAr("${key}")`;
      }
      changed += 1;
      console.log(`  ${file}: ${key} «${literal}» → «${owner}»`);
      return `${a}${key}${b}roomNameAr("${key}")`;
    }
  );
  writeFileSync(file, out, "utf8");
  console.log(`${file}: ${changed} names now read from the owner`);
}

const catalog = readFileSync("lib/rooms-catalog.ts", "utf8");
const missing = VALID_ROOM_SLUG_LIST.filter((slug) => !roomNameAr(slug));
console.log(`\ncanonical slugs without an Arabic name: ${missing.length ? missing.join(", ") : "مفيش"}`);
console.log(`catalog lines in the owner file: ${(catalog.match(/roomNameAr/g) ?? []).length}`);

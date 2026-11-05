import { readFileSync, writeFileSync } from "node:fs";

/**
 * Rewrites the next-opening calculation so only Friday closes the store, and rebuilds every
 * sentence that quotes an hour from the configuration instead of repeating one in prose.
 *   node scratch/fix-office-hours.mjs        — show what would change
 *   node scratch/fix-office-hours.mjs apply  — write, then read the file back and count
 */
const APPLY = process.argv[2] === "apply";
const FILE = "lib/office-hours.ts";

const NEW_FUNCTION = `/**
 * The next moment the store opens: today when that hour is still ahead, otherwise the next
 * working day. Every day works — Friday is the only one this store closes.
 */
export function getNextOpenTime(fromDate: Date = getCairoTime()): Date {
  const nextOpen = new Date(fromDate);

  if (isFriday(nextOpen)) {
    nextOpen.setDate(nextOpen.getDate() + 1);
    nextOpen.setHours(OFFICE_CONFIG.openHour, 0, 0, 0);
    return nextOpen;
  }

  if (nextOpen.getHours() < OFFICE_CONFIG.openHour) {
    nextOpen.setHours(OFFICE_CONFIG.openHour, 0, 0, 0);
    return nextOpen;
  }

  nextOpen.setDate(nextOpen.getDate() + 1);
  if (isFriday(nextOpen)) nextOpen.setDate(nextOpen.getDate() + 1);
  nextOpen.setHours(OFFICE_CONFIG.openHour, 0, 0, 0);
  return nextOpen;
}`;

const OLD_BLOCK = /\/\*\*\n \* Get next working day opening time\n \*\/\nexport function getNextOpenTime[\s\S]*?\n}\n/;

const messages = [
  [
    /message = `Our consultants are observing Friday\. We will review your brief as a priority at 10 AM on \$\{daysUntil\}\.`;/,
    "message = `Our consultants are observing Friday. We will review your brief as a priority at ${openHourLabel()} on ${daysUntil}.`;",
  ],
  [
    /message = `Our consultants have concluded for the day\. We will review your brief as a priority at 10 AM on \$\{daysUntil\}\.`;/,
    "message = `Our consultants have concluded for the day. We will review your brief as a priority at ${openHourLabel()} on ${daysUntil}.`;",
  ],
  [
    /message = `Our consultants are available until 6 PM Cairo time \(\$\{hoursRemaining\} hour\$\{hoursRemaining > 1 \? "s" : ""\} remaining\)\.`;/,
    "message = `Our consultants are available until ${closeHourLabel()} Cairo time (${hoursRemaining} hour${hoursRemaining > 1 ? \"s\" : \"\"} remaining).`;",
  ],
];

const HELPERS = `
/** The hour the store opens, in the words its own sentences quote. */
function openHourLabel(): string {
  return clockLabel(OFFICE_CONFIG.openHour);
}

/** The hour the store closes, in the words its own sentences quote. */
function closeHourLabel(): string {
  return clockLabel(OFFICE_CONFIG.closeHour);
}

function clockLabel(hour24: number): string {
  const clock = ((hour24 + 11) % 12) + 1;
  return \`\${clock} \${hour24 < 12 ? "AM" : "PM"}\`;
}
`;

let src = readFileSync(FILE, "utf8");
const before = src;
const report = [];

if (OLD_BLOCK.test(src)) {
  src = src.replace(OLD_BLOCK, `${NEW_FUNCTION}\n`);
  report.push("getNextOpenTime rewritten (Friday is the only closed day)");
} else {
  report.push("getNextOpenTime block not found — nothing written for it");
}

for (const [pattern, replacement] of messages) {
  if (!pattern.test(src)) {
    report.push(`message not matched: ${pattern.source.slice(0, 40)}…`);
    continue;
  }
  src = src.replace(pattern, replacement);
  report.push("message now derived from the configuration");
}

if (!src.includes("function clockLabel")) {
  src = src.replace("export function getOfficeStatus", `${HELPERS}\nexport function getOfficeStatus`);
  report.push("clock labels added");
}

for (const line of report) console.log("· " + line);

if (APPLY) {
  writeFileSync(FILE, src, "utf8");
  const reread = readFileSync(FILE, "utf8");
  console.log(
    `قراية راجعة: الحجم ${before.length} → ${reread.length} محرف · "10 AM" باقيلة = ${(reread.match(/10 AM/g) ?? []).length} · "6 PM" باقية = ${(reread.match(/6 PM/g) ?? []).length} · سبت/أحد مقفولين = ${(reread.match(/dayOfWeek === [06]/g) ?? []).length}`,
  );
}

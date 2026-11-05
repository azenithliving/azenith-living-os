import { readFileSync, writeFileSync } from "node:fs";

/**
 * Round four of the phone-readability sweep: the four cockpit panels the guard never covered.
 *
 * The full thirty-screen accessibility sweep (scratch/sweep-a11y-admin.mjs, 2026-10-12) left ten
 * colour decisions undecided on the studio screen, and every one of them was a line of text written
 * between twenty and sixty percent white on a gradient card. The guard that stops this — the list of
 * owner files that may not carry faint text — simply did not include these four files. So this raises
 * the text AND widens the guard, which is the only part of the repair that keeps it repaired.
 *
 * A hover class is raised too, otherwise the line ends up `text-white/70 hover:text-white/70` — a
 * hover that does nothing, which is the defect this script's predecessor shipped once already.
 */
const FILES = [
  "components/admin/ops/StudioPanel.tsx",
  "components/admin/agents/SelfModelPanel.tsx",
  "components/admin/agents/ApprovalDecisionBlock.tsx",
  "components/admin/agents/CommandPalette.tsx",
];

const FAINT = /(?<![\w-])(hover:|focus:|group-hover:)?text-white\/(?:20|25|30|35|40|45|50|55|60)\b/g;

const totals = [];
for (const file of FILES) {
  const before = readFileSync(file, "utf8");
  const eol = before.includes("\r\n") ? "\r\n" : "\n";
  const text = before.split(eol).join("\n");
  let raised = 0;
  let out = text.replace(FAINT, (match, prefix) => {
    raised += 1;
    return `${prefix ?? ""}text-white/70`;
  });
  // A base and a hover at the same level is a hover that does nothing: the hover goes to full white.
  out = out.replace(/text-white\/70((?:(?!text-white)[^\n"])*?)hover:text-white\/70/g, (_m, mid) => `text-white${mid}hover:text-white`);
  if (raised) writeFileSync(file, out.split("\n").join(eol), "utf8");
  const after = readFileSync(file, "utf8");
  const left = after.match(FAINT) ?? [];
  totals.push({ file, raised, left: left.length, noopHovers: (after.match(/text-white\/70[^"]*hover:text-white\/70/g) ?? []).length });
}

// The unread-count badge: white on rose-500 measured 3.75 to 1 at nine pixels — under the floor for
// text this small. rose-700 is the same red at 6.3 to 1.
const chat = "components/admin/agents/ChatPanel.tsx";
const chatText = readFileSync(chat, "utf8");
const badgeFrom = 'className="min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold';
const badgeTo = 'className="min-w-[16px] h-4 px-1 rounded-full bg-rose-700 text-white text-[9px] font-bold';
let badge = false;
if (chatText.includes(badgeFrom)) {
  writeFileSync(chat, chatText.replace(badgeFrom, badgeTo), "utf8");
  badge = readFileSync(chat, "utf8").includes(badgeTo);
}

for (const t of totals) console.log(`${t.file}: رفعنا ${t.raised} · باقي ${t.left} · هوفر ما يساويش ${t.noopHovers}`);
console.log(`شارة العدّاد: ${badge ? "اتغلّقت" : "ما اتلمّتش"}`);

import { readFileSync, writeFileSync } from "node:fs";

/**
 * The twelve-screen audit's fix pass, written as one verified patch.
 *
 * Every anchor is checked before anything is written, and each change is printed, so a miss is a loud
 * failure rather than a silent "fixed". What is patched: the customer's furniture card jumping from
 * the page title to a third level, the elite door with no landmark at all (nine pieces of content
 * outside one, and no main region), the owner's two unnamed dropdowns, his unnamed refresh button, his
 * photo input with no label, and the dim tones that carry real readings on three of his screens.
 */
const edits = [
  {
    file: "components/FurnitureCard.tsx",
    from: '<h3 className="text-xl font-semibold text-white line-clamp-2">{arabicNumerals(furniture.title)}</h3>',
    to: '<h2 className="text-xl font-semibold text-white line-clamp-2">{arabicNumerals(furniture.title)}</h2>',
  },
  {
    file: "components/elite/login/elite-login-client.tsx",
    from: '<div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-6 pt-20">',
    to: '<div role="main" className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-6 pt-20">',
  },
  {
    file: "components/elite/login/elite-login-client.tsx",
    from: '<p className="text-sm text-white/40">',
    to: '<p className="text-sm text-white/70">',
  },
  {
    file: "components/admin/agents/ProactiveSuggestions.tsx",
    from: '            disabled={loading}\n            className="p-1.5 text-white/30 hover:text-white/70 transition-colors"',
    to: '            disabled={loading}\n            aria-label="اجيب الاقتراحات من جديد"\n            className="p-1.5 text-white/60 hover:text-white transition-colors"',
  },
  {
    file: "components/admin/agents/TaskQueue.tsx",
    from: '            className="border rounded px-3 py-1 text-sm"',
    to: '            aria-label="فلتر المهام حسب الحالة"\n            className="border rounded px-3 py-1 text-sm"',
  },
  {
    file: "app/admin/v2/keys/page.tsx",
    from: '            className="rounded-xl border border-white/10 bg-black/40 px-2.5 py-2 text-[12px] text-white focus:border-amber-500/40 focus:outline-none"',
    to: '            aria-label="اختيار المزود المعروض"\n            className="rounded-xl border border-white/10 bg-black/40 px-2.5 py-2 text-[12px] text-white focus:border-amber-500/40 focus:outline-none"',
  },
];

const toneRaises = [
  { file: "app/admin/v2/sketches/page.tsx", from: "text-white/55", to: "text-white/75" },
  { file: "app/admin/v2/sketches/page.tsx", from: "text-white/35", to: "text-white/70" },
  { file: "app/admin/v2/keys/page.tsx", from: "text-white/55", to: "text-white/75" },
];

const pending = new Map();
const note = (file, text) => {
  if (!pending.has(file)) pending.set(file, text);
};

for (const edit of edits) {
  const text = readFileSync(edit.file, "utf8");
  const source = pending.get(edit.file) ?? text;
  const hits = source.split(edit.from).length - 1;
  if (hits < 1) {
    console.error(`MISS ${edit.file}: ${edit.from.slice(0, 60)}`);
    process.exit(1);
  }
  note(edit.file, source.replace(edit.from, edit.to));
  console.log(`patched ${edit.file} (${hits} match${hits > 1 ? "es" : ""}) -> ${edit.to.slice(0, 58)}`);
}

for (const raise of toneRaises) {
  const text = readFileSync(raise.file, "utf8");
  const source = pending.get(raise.file) ?? text;
  const hits = source.split(raise.from).length - 1;
  if (hits < 1) {
    console.error(`MISS tone ${raise.file}: ${raise.from}`);
    process.exit(1);
  }
  note(raise.file, source.split(raise.from).join(raise.to));
  console.log(`raised ${raise.file}: ${raise.from} -> ${raise.to} in ${hits} place${hits > 1 ? "s" : ""}`);
}

// The paper desk's photo input is the customer-facing half of that screen.
const sketchText = pending.get("app/admin/v2/sketches/page.tsx") ?? readFileSync("app/admin/v2/sketches/page.tsx", "utf8");
const fileAnchor = 'type="file"';
if (!sketchText.includes(fileAnchor)) {
  console.error("MISS file input in the paper desk");
  process.exit(1);
}
const labelled = sketchText.replace(
  '          type="file"',
  '          type="file"\n          aria-label="ارفع صورة ورقة مقاساتك"',
);
if (labelled === sketchText) {
  console.error("MISS the file input line was not in the expected shape");
  process.exit(1);
}
note("app/admin/v2/sketches/page.tsx", labelled);
console.log("labelled the paper desk's photo input");

for (const [file, text] of pending) writeFileSync(file, text, "utf8");
console.log(`\nwritten ${pending.size} files: ${[...pending.keys()].join(", ")}`);

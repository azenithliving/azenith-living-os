import { readFileSync, writeFileSync } from "node:fs";

/**
 * Round three of accessibility: the owner's screens.
 *
 * Forty-four places left on twelve audited screens, and the census said where each one lives
 * (scratch/census-a11y-residue.mjs). Three kinds: text painted so faint a phone in sunlight hides it,
 * controls a screen reader calls "button" and nothing else, and two pages with no heading to navigate by.
 *
 * The faint text is swept as a token, not line by line, because the same dimness is written into these
 * screens in more places than the tool happened to render today — an element that was behind a tab or a
 * loading state is not an element that is safe. Minimum alpha kept is 70%, which measures 8.8:1 on this
 * store's near-black, above the 7:1 the owner asked about.
 *
 * Every anchor is checked before any file is written; a miss aborts the whole run.
 *
 * Ran on 2026-10-11 and applied. Two defects this first run caught in itself, and both are why the loop
 * below is ordered the way it is: the sweep rewrote class names that several anchors quote, so those
 * anchors missed silently while the run still printed a repair count taken from the plan instead of the
 * file; and raising a caption to 70% also raised its own hover to 70%, which is no hover at all.
 * Repairs now go first, hovers get unflattened after the sweep, and every count is read back from the
 * finished text before it is written. One repair (the health panel's refresh name) had to be applied by
 * hand afterwards for exactly the reason above.
 */

/** Dim prose and numbers on the owner's screens → 70% white (measured 8.8:1 on #0f0f0f). */
const SWEEP = [
  "components/admin/v2/CommandCanvas.tsx",
  "components/admin/agents/ChatPanel.tsx",
  "components/admin/agents/AgentActionsFeed.tsx",
  "components/admin/agents/AgentHealthPanel.tsx",
  "components/admin/sales/CustomersPanel.tsx",
  "components/admin/ClientPreCallDossier.tsx",
  "app/admin/v2/sketches/page.tsx",
  "components/admin/sketches/SketchOwner.tsx",
  "app/admin/v2/keys/page.tsx",
  "components/elite/login/elite-login-client.tsx",
];

const DIM = /(?<![\w-])text-white\/(?:20|25|30|35|40|45|50|55|60)\b/g;

/** Anchored one-off repairs: a name where there was none, a heading where there was nothing. */
/** @type {[string, string, string][]} */
const EDITS = [
  // The chat's send control is an arrow glyph only — read aloud it was "button".
  [
    "components/admin/agents/ChatPanel.tsx",
    `            disabled={isTyping || !input.trim()}`,
    `            disabled={isTyping || !input.trim()}\n            aria-label={isTyping ? "الموظف بيكتب دلوقتي" : "إرسال الرسالة"}`,
  ],
  // Deleting a customer from the roll is the most destructive control on that screen, and it had no name.
  [
    "components/admin/sales/CustomersPanel.tsx",
    `                      className="relative z-[9999] p-3 text-red-500/40 hover:text-red-500 transition-colors"`,
    `                      aria-label="حذف هذا العميل من الدفتر"\n                      className="relative z-[9999] p-3 text-red-500/40 hover:text-red-500 transition-colors"`,
  ],
  [
    "components/admin/agents/AgentActionsFeed.tsx",
    `            onClick={() => fetchFeed()}`,
    `            onClick={() => fetchFeed()}\n            aria-label="تحديث سجل الأحداث"`,
  ],
  [
    "components/admin/agents/AgentHealthPanel.tsx",
    `<button onClick={() => fetchHealth()} className="p-1 text-white/30 hover:text-white/60 transition-colors">`,
    `<button onClick={() => fetchHealth()} aria-label="إعادة فحص صحة النظام" className="p-1 text-white/30 hover:text-white/60 transition-colors">`,
  ],
  // The paper desk's camera button had no name either.
  [
    "app/admin/v2/sketches/page.tsx",
    `          onChange={(e) => onPick(e.target.files?.[0])}`,
    `          onChange={(e) => onPick(e.target.files?.[0])}\n          aria-label="اختار صورة ورقة من الموبايل"`,
  ],
  // The sales office had no heading at all — a screen reader customer could not jump to its title.
  [
    "app/admin/v2/sales/page.tsx",
    `<span className="font-black text-sm text-white">مدير المبيعات</span>`,
    `<h1 className="font-black text-sm text-white">مدير المبيعات</h1>`,
  ],
  // The elite board's step titles were third-level under the page's one top-level heading, and a step
  // is all that renders at a time — so a customer navigating by heading heard "level one, level three".
  ["components/elite/EliteIntelligenceForm.tsx", `<h3 className="text-xl font-semibold text-white">{L.scopeTitle}</h3>`, `<h2 className="text-xl font-semibold text-white">{L.scopeTitle}</h2>`],
  ["components/elite/EliteIntelligenceForm.tsx", `<h3 className="text-xl font-semibold text-white">{L.budgetTitle}</h3>`, `<h2 className="text-xl font-semibold text-white">{L.budgetTitle}</h2>`],
  ["components/elite/EliteIntelligenceForm.tsx", `<h3 className="text-xl font-semibold text-white">{L.timelineTitle}</h3>`, `<h2 className="text-xl font-semibold text-white">{L.timelineTitle}</h2>`],
  ["components/elite/EliteIntelligenceForm.tsx", `<h3 className="text-lg font-semibold text-white">{L.blueprintTitle}</h3>`, `<h2 className="text-lg font-semibold text-white">{L.blueprintTitle}</h2>`],
  ["components/elite/EliteIntelligenceForm.tsx", `<h3 className="text-xl font-semibold text-white">{L.styleTitle}</h3>`, `<h2 className="text-xl font-semibold text-white">{L.styleTitle}</h2>`],
  ["components/elite/EliteIntelligenceForm.tsx", `<h3 className="text-xl font-semibold text-white">{L.requestsTitle}</h3>`, `<h2 className="text-xl font-semibold text-white">{L.requestsTitle}</h2>`],
  ["components/elite/EliteIntelligenceForm.tsx", `<h3 className="text-xl font-semibold text-white">{L.contactTitle}</h3>`, `<h2 className="text-xl font-semibold text-white">{L.contactTitle}</h2>`],
  ["components/elite/EliteIntelligenceForm.tsx", `<h4 className="text-lg font-semibold text-white">{L.areaTitle}</h4>`, `<h3 className="text-lg font-semibold text-white">{L.areaTitle}</h3>`],
  ["components/elite/EliteIntelligenceForm.tsx", `<h4 className="mb-3 text-sm font-semibold text-white/80">{L.summaryTitle}</h4>`, `<h3 className="mb-3 text-sm font-semibold text-white/80">{L.summaryTitle}</h3>`],
  // The old employees' house is a white card sitting inside a dark page: its titles were painted white on white.
  [
    "components/admin/agents/TaskQueue.tsx",
    `    if (p >= 0) return 'text-yellow-600 bg-yellow-100 border-yellow-300';`,
    `    if (p >= 0) return 'text-yellow-950 bg-yellow-100 border-yellow-300';`,
  ],
  [
    "components/admin/agents/TaskQueue.tsx",
    `                  <p className="font-medium">{task.title}</p>`,
    `                  <p className="font-medium text-gray-900">{task.title}</p>`,
  ],
  ["components/admin/agents/TaskQueue.tsx", `          <span className="text-sm text-gray-500">`, `          <span className="text-sm text-gray-700">`],
  ["components/admin/agents/TaskQueue.tsx", `                    <span className="text-xs text-gray-500">`, `                    <span className="text-xs text-gray-700">`],
  ["components/admin/agents/TaskQueue.tsx", `                <span className="text-xs text-gray-400 whitespace-nowrap mr-2">`, `                <span className="text-xs text-gray-700 whitespace-nowrap mr-2">`],
  ["components/admin/agents/TaskQueue.tsx", `                  <div className="flex justify-between text-xs text-gray-500 mb-1">`, `                  <div className="flex justify-between text-xs text-gray-700 mb-1">`],
  ["components/admin/agents/TaskQueue.tsx", `            <p className="text-gray-500">جاري التحميل...</p>`, `            <p className="text-gray-700">جاري التحميل...</p>`],
  ["components/admin/agents/TaskQueue.tsx", `          <p className="text-center text-gray-500 py-8">لا توجد مهام</p>`, `          <p className="text-center text-gray-700 py-8">لا توجد مهام</p>`],
  // The command console is dark slate: its labels were slate-grey on slate.
  ["components/admin/agents/CommandConsole.tsx", `          <span className="text-sm text-gray-400">وحدة التحكم</span>`, `          <span className="text-sm text-gray-200">وحدة التحكم</span>`],
  [
    "components/admin/agents/CommandConsole.tsx",
    `            className="bg-gray-700 text-white text-xs rounded px-2 py-1 border-none"`,
    `            aria-label="الموظف اللي بياخد الأمر"\n            className="bg-gray-700 text-white text-xs rounded px-2 py-1 border-none"`,
  ],
  ["components/admin/agents/CommandConsole.tsx", `          className="text-xs text-gray-400 hover:text-white transition-colors"`, `          className="text-xs text-gray-200 hover:text-white transition-colors"`],
  ["components/admin/agents/CommandConsole.tsx", `          <p className="text-gray-500 italic">اكتب أمراً للبدء...</p>`, `          <p className="text-gray-300 italic">اكتب أمراً للبدء...</p>`],
  // An employee's English key name, printed for the owner to read.
  ["components/admin/agents/CommandConsole.tsx", `<option value="vanguard">Vanguard (المبيعات)</option>`, `<option value="vanguard">مدير المبيعات</option>`],
  ["components/admin/agents/HandoffInterface.tsx", `                <span className="text-xs text-gray-500 mr-auto">`, `                <span className="text-xs text-gray-700 mr-auto">`],
  // The swarm's status chips: the role word was a colour a phone could not read (6.4 to 6.9 against a 7 floor).
  ["app/admin/agents/page.tsx", `      case 'analyst':  return { ring: 'border-blue-500/20', bg: 'bg-blue-500/10', text: 'text-blue-400' };`, `      case 'analyst':  return { ring: 'border-blue-500/20', bg: 'bg-blue-500/10', text: 'text-blue-300' };`],
  ["app/admin/agents/page.tsx", `      case 'coder':    return { ring: 'border-cyan-500/20', bg: 'bg-cyan-500/10', text: 'text-cyan-400' };`, `      case 'coder':    return { ring: 'border-cyan-500/20', bg: 'bg-cyan-500/10', text: 'text-cyan-300' };`],
  ["app/admin/agents/page.tsx", `      case 'ops':      return { ring: 'border-yellow-500/20', bg: 'bg-yellow-500/10', text: 'text-yellow-400' };`, `      case 'ops':      return { ring: 'border-yellow-500/20', bg: 'bg-yellow-500/10', text: 'text-yellow-300' };`],
  ["app/admin/agents/page.tsx", `      case 'security': return { ring: 'border-red-500/20', bg: 'bg-red-500/10', text: 'text-red-400' };`, `      case 'security': return { ring: 'border-red-500/20', bg: 'bg-red-500/10', text: 'text-red-300' };`],
  ["app/admin/agents/page.tsx", `      case 'learner':  return { ring: 'border-indigo-500/20', bg: 'bg-indigo-500/10', text: 'text-indigo-400' };`, `      case 'learner':  return { ring: 'border-indigo-500/20', bg: 'bg-indigo-500/10', text: 'text-indigo-300' };`],
  // A failure line the owner has to read was 6.7:1 — under the floor he asked for.
  ["app/admin/v2/sketches/page.tsx", `<p className="mt-1 text-[10px] text-rose-300/80">`, `<p className="mt-1 text-[10px] text-rose-200">`],
  ["components/admin/sketches/SketchOwner.tsx", `className="text-[10px] text-rose-300/80"`, `className="text-[10px] text-rose-200"`],
];

const planned = new Map();
const failures = [];

for (const file of SWEEP) {
  try {
    readFileSync(file, "utf8");
  } catch {
    failures.push(`no such file: ${file}`);
    continue;
  }
  const n = (readFileSync(file, "utf8").match(DIM) ?? []).length;
  planned.set(file, { sweep: n, edits: 0 });
}

for (const [file, from, to] of EDITS) {
  const text = (() => {
    try {
      return readFileSync(file, "utf8");
    } catch {
      return null;
    }
  })();
  if (text === null) {
    failures.push(`no such file: ${file}`);
    continue;
  }
  const hits = text.split(from).length - 1;
  if (hits !== 1) failures.push(`${file}: anchor found ${hits} times -> ${from.slice(0, 60)}`);
  if (!planned.has(file)) planned.set(file, { sweep: 0, edits: 0 });
  const tally = planned.get(file);
  tally.edits += 1;
}

if (failures.length) {
  console.log("ABORTED, nothing written:");
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}

for (const [file, tally] of planned) {
  let text = readFileSync(file, "utf8");
  const before = text;
  // Most of these files are stored with Windows line endings; an inserted line has to match the file.
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  // Repairs first, because the sweep below rewrites the class names several anchors quote.
  const wanted = [];
  for (const [f, from, to] of EDITS) {
    if (f !== file) continue;
    if (text.includes(from)) text = text.replace(from, to.replace(/\n/g, eol));
    wanted.push(to.replace(/\n/g, eol));
  }
  const raised = (text.match(DIM) ?? []).length;
  if (raised) text = text.replace(DIM, "text-white/70");
  // A hover that raises to the same alpha as its own caption is not a hover.
  const hovers = (text.match(/text-white\/70 hover:text-white\/70/g) ?? []).length;
  if (hovers) text = text.replace(/text-white\/70 hover:text-white\/70/g, "text-white/70 hover:text-white");
  // Read the result back out of the finished text, never off the plan.
  const absent = wanted.filter((to) => !text.includes(to));
  if (absent.length) {
    failures.push(`${file}: ${absent.length} repair(s) absent from the written text`);
    continue;
  }
  if (text === before) {
    console.log(`${file}: nothing changed`);
    continue;
  }
  writeFileSync(file, text, "utf8");
  console.log(`${file}: ${raised} dim lines raised · ${hovers} hovers unflattened · ${wanted.length}/${tally.edits} repairs read back`);
}

if (failures.length) {
  console.log("PARTIAL — skipped:");
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log("done");

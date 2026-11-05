import fs from "node:fs";

/**
 * One pass over the command executor: every place that used to hand the owner's chat a raw driver
 * sentence now answers in his Arabic and logs the technical text.
 *
 * Anchored on the enclosing command name, not on a global replace — twelve catches share the exact
 * same text, and a blanket swap would give "the keys could not be read" the same sentence as "the
 * backup did not run".
 */
const file = "lib/command-executor.ts";
const lines = fs.readFileSync(file, "utf8").split("\n");

const LABELS = {
  addKey: "ما قدرناش نسجّل المفتاح",
  simulateKeyUsage: "ما قدرناش نحسّب استخدام المفتاح",
  removeKey: "ما قدرناش نشيل المفتاح",
  listKeys: "ما قدرناش نقرا المفاتيح",
  rateLimit: "ما قدرناش نضبط سقف الطلبات",
  sendNotification: "ما قدرناش نبعت الإشعار",
  showStats: "ما قدرناش نقرا إحصائيات الأوامر",
  clearCache: "ما قدرناش ننضّف الذاكرة المؤقتة",
  restartService: "ما قدرناش نعيد تشغيل الخدمة",
  backupDb: "ما قدرناش نعمل نسخة احتياطية",
  readCommand: "ما قدرناش نقرا الصفحة",
  addBackupKeyCommand: "ما قدرناش نضيف المفتاح الاحتياطي",
};

const RAW = /message: (?:error instanceof Error \? error\.message : "[^"]*"|`خطأ في قراءة الصفحة: \$\{error instanceof Error \? error\.message : "Unknown error"\}`)/;

let fn = "";
let changed = 0;
const out = lines.map((line, i) => {
  const head = /export async function (\w+)/.exec(line);
  if (head) fn = head[1];
  if (!RAW.test(line)) return line;
  const label = LABELS[fn];
  if (!label) throw new Error(`line ${i + 1}: no Arabic label mapped for command "${fn}"`);
  const indent = line.match(/^\s*/)[0];
  changed += 1;
  return `${indent}message: commandFailed("${label}", error),`;
});

if (changed !== Object.keys(LABELS).length) {
  throw new Error(`expected ${Object.keys(LABELS).length} catches to move, changed ${changed}`);
}

const helper = `
/**
 * What the owner's chat shows when a command's own read fails.
 *
 * The raw driver text used to be returned as the message — a Postgres or Node sentence in English
 * landing in the middle of his Arabic chat, unreadable to him twice over (the words, and the Latin
 * inside them) and impossible to act on. He gets Arabic that names the command; the technical text
 * goes to the server log, which is where an investigation reads it.
 */
function commandFailed(what: string, error?: unknown): CommandResult {
  if (error !== undefined) console.error(\`[CommandExecutor] \${what}:\`, error);
  return {
    success: false,
    message: \`\${what} — السجل ما ردّش. التفاصيل التقنية اتسجّلت في سجل السيرفر.\`,
  };
}
`;

const body = out.join("\n");
const anchor = "// ============================================\n// 1. ADD KEY";
if (!body.includes(anchor)) throw new Error("the helper anchor (first command block) was not found");

fs.writeFileSync(file, body.replace(anchor, helper + "\n" + anchor), "utf8");
console.log("catches rewritten:", changed);

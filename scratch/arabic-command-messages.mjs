import fs from "node:fs";

/**
 * The rest of the command layer's English — and the two commands that promised more than they do.
 *
 * Measured while rewriting `show_stats`: a grep for `message: "` (a quoted literal) found nine
 * English sentences, but the file mostly builds them as template literals, so seventeen more were
 * invisible to that instrument. And two of them do not do what they say: `restart_service` runs
 * `console.log` and answers «restarted successfully», `clear_cache` pushes two strings into an array
 * and answers «Cache cleared». Those are not translation work — a lie in Arabic is still a lie — so
 * they now say what actually happens and point at the lever that does it.
 */
const file = "lib/command-executor.ts";
let source = fs.readFileSync(file, "utf8");

const SWAPS = [
  [
    "return { success: false, message: `Failed to check existing keys: ${checkError.message}` };",
    'return { success: false, message: commandFailed("ما قدرناش نتأكد من المفاتيح الموجودة", checkError.message) };',
  ],
  [
    "message: `Key already exists for ${normalizedProvider} (ID: ${existing.id}, ${existing.is_active ? 'active' : 'inactive'})`,",
    "message: `عندك مفتاح مسجّل قبل كده لـ${normalizedProvider} (رقم ${arDigits(existing.id)}، ${existing.is_active ? \"شغّال\" : \"موقوف\"})`,",
  ],
  [
    "return { success: false, message: `Failed to add key: ${error.message} (code: ${error.code})` };",
    'return { success: false, message: commandFailed("ما قدرناش نسجّل المفتاح", `${error.message} (code: ${error.code})`) };',
  ],
  [
    "message: `Key not found: ${keyId} for provider ${provider}`,",
    "message: `مفيش مفتاح بالمواصفات دي عند ${provider}.`,",
  ],
  [
    "message: `Failed to update key usage: ${updateError.message}`,",
    'message: commandFailed("ما قدرناش نسخّر استخدام المفتاح", updateError.message),',
  ],
  [
    "return { success: false, message: `Failed to remove key: ${error.message}` };",
    'return { success: false, message: commandFailed("ما قدرناش نشيل المفتاح", error) };',
  ],
  [
    "message: `Removed ${count || 0} key(s) for ${provider}`,",
    "message: `اشيل ${arNum(count || 0)} مفتاح من ${provider}.`,",
  ],
  [
    "return { success: false, message: `Failed to list keys: ${error.message}` };",
    'return { success: false, message: commandFailed("ما قدرناش نقرا المفاتيح", error) };',
  ],
  [
    "message: `Found ${data?.length || 0} key(s)`,",
    "message: `عندك ${arNum(data?.length || 0)} مفتاح مسجّل.`,",
  ],
  [
    "return { success: false, message: `Failed to update rate limit: ${error.message}` };",
    'return { success: false, message: commandFailed("ما قدرناش نضبط سقف الطلبات", error) };',
  ],
  [
    "message: `Rate limit updated: ${endpoint} = ${limit}/hour`,",
    "message: `سقف الطلبات بقى ${arDigits(limit)} في الساعة لـ${endpoint}.`,",
  ],
  [
    "message: `Cache cleared: ${cleared.join(\", \")}`,\n      data: { clearedTypes: cleared, requestedType: type },",
    "message:\n        \"المتجر ما بينضّفش الذاكرة المؤقتة من الشات — هي بتتغيّر لوحدها مع كل نسخة جديدة تنزل. الطلب اتسجّل بس.\",\n      data: { clearedTypes: cleared, requestedType: type },",
  ],
  [
    "message: `Unknown service. Valid: ${validServices.join(\", \")}`,",
    "message: `«${service}» مش من خدمات المتجر المعروفة.`,",
  ],
  [
    "message: `Service '${service}' restarted successfully`,",
    "message:\n        `المتجر ما بيعيدش تشغيل خدمة من الشات — اللي بيحدّث الخدمة فعلًا هو نزول نسخة جديدة. قول «انشر» وده بيحصل.`,",
  ],
  [
    "return { success: false, message: `Failed to create backup: ${error.message}` };",
    'return { success: false, message: commandFailed("ما قدرناش نعمل نسخة احتياطية", error) };',
  ],
  [
    "message: `Database backup created: ${Object.keys(backup).length} tables`,",
    "message: `النسخة الاحتياطية اتعملت من ${arNum(Object.keys(backup).length)} جدول.`,",
  ],
  [
    "message: `Invalid provider. Must be one of: ${validProviders.join(\", \")}`,",
    "message: `«${provider}» مش من المزوّدين اللي عندنا.`,",
  ],
];

for (const [from, to] of SWAPS) {
  if (!source.includes(from)) throw new Error(`anchor not found: ${from.slice(0, 70)}`);
  source = source.replace(from, to);
}

// The two simulated commands must not answer `success: true` any more than they answer in English.
const honest = [
  [
    "      success: true,\n      message:\n        \"المتجر ما بينضّفش",
    "      success: false,\n      message:\n        \"المتجر ما بينضّفش",
  ],
  [
    "      success: true,\n      message:\n        `المتجر ما بيعيدش",
    "      success: false,\n      message:\n        `المتجر ما بيعيدش",
  ],
];
for (const [from, to] of honest) {
  if (!source.includes(from)) throw new Error(`success anchor not found: ${from.slice(0, 40)}`);
  source = source.replace(from, to);
}

const leftovers = source.match(/message: [`"][A-Za-z][^`"]*/g) ?? [];
if (leftovers.length) throw new Error(`English messages remain: ${leftovers.join(" | ")}`);

fs.writeFileSync(file, source, "utf8");
console.log("messages rewritten:", SWAPS.length, "· simulated commands made honest:", honest.length);

import { readFileSync, writeFileSync } from "node:fs";

/**
 * Master-list item 47 («ولا أداة وهمية ولا رقم مختلق») carried a standing debt: the honesty
 * guard was stopped on the atom «every chat row says which desk wrote it». That atom is now
 * built and proved live, so the item says so — with the number it was measured at.
 */
const PATH = "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";
const ar = (t) => t.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));

const ADD = ar(
  " والسجل اللي كان مفقود ده اتعمل النهاردة: كل سطر في محادثة المالك بيكتب هو أنهي باب، وكل مكتب اتشغّل بيسجّل باسمه ونتيجته، واللي وراه قائمة فاضية صريحة بدل الفراغ — وأربع أبواب اتوصلت بيه. مقاس على المنشور بعرض ٣٩٠: سطر «ايزاي الشغل الفترة دي» طلع بسجل \`ops_world\` واسمه على الشاشة · وسطر الفحص الشامل (كان بيفضل فاضي وراه شغل حقيقي) طلع بسجل \`site_audit\` · وسطر «صباح الخير» طلع بقائمة فاضية، والحرّاس كشفوا عليه ادّعاء «فحصت ١٥ غرفة» من غير ما مكتب يشتغل، وختموه بـ«مفيش مكتب اتشغّل في الطلب ده». الذرّة اللي كانت معوّقة الخطوة الجاية (موظف ما يقولش شرط شغل ما قاسوش) اتفتحت."
);

const before = readFileSync(PATH, "utf8");
const lines = before.split("\n");
const i = lines.findIndex((l) => l.startsWith("٤٧."));
if (i < 0) throw new Error("item 47 not found");
if (lines[i].includes("والسجل اللي كان مفقود ده اتعمل")) {
  console.log("already updated — nothing written");
} else {
  lines[i] = lines[i].trimEnd() + ADD;
  writeFileSync(PATH, lines.join("\n"), "utf8");
  console.log(`item 47 line ${i + 1}: ${before.length} → ${lines.join("\n").length} chars`);
}
const after = readFileSync(PATH, "utf8").split("\n")[i];
console.log("tail:", after.slice(-220));

import { readFileSync, writeFileSync } from "node:fs";

/**
 * Remove the English gloss in parentheses from Arabic copy on the owner's screens.
 * Every pair here says the Arabic word and then repeats it in Latin; the Arabic stays.
 */
const edits = [
  ["app/admin/owner-dashboard/page.tsx", "ذكاء الإنتاج (Production Intel)", "ذكاء الإنتاج"],
  ["app/admin/owner-dashboard/page.tsx", "التدفق التشغيلي (Operational Flow)", "التدفق التشغيلي"],
  ["app/admin/sales/page.tsx", "عنوان الموقع (SEO Title)", "عنوان الموقع"],
  ["app/admin/sales/page.tsx", "وصف الموقع (SEO Description)", "وصف الموقع"],
  ["app/admin/sales/page.tsx", "الكلمات المفتاحية (SEO Keywords)", "الكلمات المفتاحية"],
  ["app/admin/sales/page.tsx", "الخط (Font Family)", "الخط"],
  ["app/admin/sales/page.tsx", "رابط الشعار (Logo URL)", "رابط الشعار"],
  ["app/admin/sales/page.tsx", "رابط الأيقونة (Favicon URL)", "رابط الأيقونة"],
  ["components/admin/ArchitectWidget.tsx", "أدخل أمر التكوين (Genesis)...", "أدخل أمر التكوين..."],
  ["components/admin/NeuralStream.tsx", "سجل استدلال وعمليات الوكلاء (Agent Reasoning Stream)", "سجل استدلال وعمليات الوكلاء"],
  ["components/admin/sales/CustomersPanel.tsx", "رادار الاستشعار الحي (Telemetry)", "رادار الاستشعار الحي"],
  ["components/admin/sales/CustomersPanel.tsx", "معدل الانتباه (Attention)", "معدل الانتباه"],
  ["components/admin/SovereignPulse.tsx", "سجل أحداث النظام اللحظي (Event Stream)", "سجل أحداث النظام اللحظي"],
];

const byFile = new Map();
for (const [file, from, to] of edits) {
  const list = byFile.get(file) ?? [];
  list.push([from, to]);
  byFile.set(file, list);
}

for (const [file, pairs] of byFile) {
  const original = readFileSync(file, "utf8");
  const crlf = original.includes("\r\n");
  let text = original.replace(/\r\n/g, "\n");
  for (const [from, to] of pairs) {
    const hits = text.split(from).length - 1;
    if (hits !== 1) throw new Error(`${file}: expected one copy of «${from}», found ${hits}`);
    text = text.split(from).join(to);
  }
  writeFileSync(file, crlf ? text.replace(/\n/g, "\r\n") : text, "utf8");
  console.log(`${file}: ${pairs.length} glosses removed`);
}

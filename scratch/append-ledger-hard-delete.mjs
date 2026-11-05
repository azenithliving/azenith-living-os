import { appendFileSync } from "node:fs";

/** The owner's explicit hard-delete word: the seventeen stale copies are gone from the disk. */
const ar = (text) => text.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));
const now = new Date();
const stamp = ar(
  `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate())
    .padStart(2, "0")} ${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`
);

const TICK = "`";
const line = `

- **وكيل المتجر (${stamp}):** **كلمة «امحيها فعليًا»: السبعتاشر نسخة قديمة اتمحت من على القرص.**
  - **قبل المسح اتقاس:** ١٧ ملف في الأرشيف بره المشروع، ٧٦٤ كيلوبايت، وصفر منهم فيه واحد من الأربعة اعتماد (كانوا اتنظفوا قبل ما يطلعوا بره المشروع) — فاللي راح هو النسخ القديمة من باقي الضبط، وده المقصود: مكان أقل على القرص بيحمل مفاتيح.
  - **بعد المسح:** مجلد النسخ مش موجود · أرشيف المالك فيه دلوقتي ملف واحد للقيم الأربعة (${TICK}نسخ-احتياطية/env-local-removed-2026-10-09.txt${TICK} — ده الرجيع الوحيد، وما تمحيش لأنه أمر مسح تاني) وحزمة چيت القديمة · جذر المشروع لسه بـ٧ ملفات ضبط والملف الحيّ بـ١٠٠ اسم · ١٩٣٢ اختبار أخضر والبناء سليم (مفيش أي ملف من الممحي كان بيتقرا).
  - **اللي لسه مفتوح:** الأربعة على المنصة نفسها (فيرسل) — محتاجين شاشة المالك، ولو كانوا أحيار هناك فالأحسن دوران مش مسح.
`;

appendFileSync("docs/ledger/council-minutes.md", ar(line), "utf8");
console.log("appended");

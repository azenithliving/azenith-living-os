import { appendFileSync } from "node:fs";

/** The owner ordered a deletion — the record says what was deleted, where, and what was kept. */
const ar = (text) => text.replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));
const now = new Date();
const stamp = ar(
  `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate())
    .padStart(2, "0")} ${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`
);

const minute = `

- **وكيل المتجر (${stamp}):** **كلمته في التطهير: أربعة أسماء اعتماد راحت من ملف الضبط المحلي، والباقي سليم.**
  - **اللي اتقاس قبل المسح:** ملف الضبط فيه ١٠٤ اسم؛ ٥٨ الكود بيوصل ليهم فعلًا، و٤٦ لأ. من الـ٤٦، أربعة بيانات اعتماد — اثنين منهم بأسماء بتبدأ بـ«NEXT_PUBLIC» ودي حاجة بتتبعت لمتصفح كل زائر لو اتحطت على المنصة: \`DEV_BACKDOOR_PASSWORD\` · \`NEXT_PUBLIC_INTERNAL_API_KEY\` · \`CLOUDFLARE_API_TOKEN\` · \`NEXT_PUBLIC_NEKO_PASSWORD\`. ولا واحد منهم بيقرأه ملف في المتجر؛ بيظهروا بس في سكربتات قديمة. ومخازن مفاتيح الشغل الحقيقي بقت في القاعدة (خدمة توزيع المفاتيح مابقتش تقرأ من البيئة من أصله).
  - **اللي اتعمل:** المالك قال «امسح الأربعة من الملف المحلي» — اتشالوا. الملف بقى ١٠٠ اسم، والأسماء الـ١٠٠ التانية سليمة حرف بحرف، وصفر بيانات اعتماد مهجورة فاضلة. نسخة الأربعة اتحطت بره المستودع في أرشيف المالك (\`نسخ-احتياطية/@@FILE@@\`) فالعملية رجيعها موجود لحد ما يقول يمحيها. ملف الضبط مش داخل چيت (\`.gitignore\` بيشمل \`.env*\`) — يعني مفيش نسخة منهم اتخزنت في تاريخ المستودع.
  - **البوابات بعد المسح:** ١٩٣٢ اختبار أخضر · بناء كامل · مفيش حاجة اتنشر (الملف محلي بس، ومفيش حاجة في الكود بتقرا الأربعة).
  - **اللي لسه بره كلمته:** نفس الأربعة موجودين كمان في ١٢ لـ ١٨ نسخة احتياطية ومؤقتة من ملفات الضبط على القرص (\`.env.backup*\`, \`.env.vercel*\`, \`.env.local.backup*\` — ٢٥ ملف من النوع ده). دي ملفات قدامه مش بيتقري منها، بس الأرقام لسه جواها. مسحها أمر حذف تاني، ولسه مستني كلمة صريحة. وكمان قايمة المنصة (فيرسل) مش مقروءة من هنا — دي على شاشته.
`;

appendFileSync("docs/ledger/council-minutes.md", ar(minute).split("@@FILE@@").join("env-local-removed-2026-10-09.txt"), "utf8");
console.log("appended");

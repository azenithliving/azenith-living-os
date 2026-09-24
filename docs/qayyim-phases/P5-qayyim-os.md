# PHASE P5 — Qayyim OS v3 (من لوحة تحكم إلى كيان)

> 🇪🇬 ملخص: ملاحظات الأدمن الحية (6 صور) كشفت إن البنية صح بس التجربة مبعثرة: كارت زحمة، شات modal صغير بلا فاصل غير-مقروءات، أزرار اقتراحات مبنية ولا أحد يرسلها، روابط يهلوسها الـ LLM وفلتر `:695` يمرر `/products` الوهمي، قائمة «أدوار» عامة من 3 أزرار، خطأ توجيه «No running subtask found»، و3 مداخل شات مكررة. المرحلة دي بتحوّل قيم الدار لكيان واحد ذكي موثوق — بدون أي تكلفة، على المفاتيح المجانية الموجودة.

## أدلة التشخيص (file:line — مؤكدة 2026-09-24)

| العرض | الجذر |
|---|---|
| كارت مزدحم | `app/admin/v2/agents/page.tsx:81-157` (إحصائيات+معطيات+مهام+أزرار في شاشة) |
| الشات ليس واتساب | `page.tsx:170-174` modal `max-w-2xl`؛ `ChatPanel.tsx:199` `firstUnreadRef` مهمل؛ `:273-274` البولينج يمحو التاريخ المحلي |
| «اكتب لي X» بدل أزرار | `ChatPanel.tsx:682-690` مستقبل `metadata.suggestions/nextActions` موجود — الخادم لا يرسلها إلا في مسار audit (`AgentOrchestrator.ts:310-311`) |
| رابط 404 `/products/...` | `MasterOrchestrator.ts:695` whitelist يقبل `/products` وهو مسار غير موجود (الموجود: `/rooms/[slug]`, `/furniture/[type]` بحثي)؛ `ChatPanel.tsx:179` الروابط في النص لا تتحول <a> |
| أدوار = 3 أزرار عامة | `ChatPanel.tsx:55-91` `AGENT_MISSIONS` بلا أي مفتاح `qayyim-*` → fallback `:451` |
| «No running subtask found» | `MasterOrchestrator.ts:676-686` `shouldContinue` يقول execute إذا pending>0 حتى لو كلها محجولة بـ dependsOn وهمية من `decomposeRequest:463` (لا تعقيم) → `:261-263` يفشل |
| 3 مداخل شات | `app/admin/qayyim/page.tsx:100` + `app/admin/v2/qayyim/page.tsx:44` + الشريط الجانبي الميت `QayyimStudio.tsx:82` |

## المراحل (كل مرحلة كوميت مستقل قابل للنشر)

### M1 — الدماغ (تقتل: هلوسة، أزرار، غباء، توجيه)
1. NEW `lib/qayyim/url-manifest.ts`: مصدر حقيقة واحد للمسارات — STATIC (`/`, `/rooms`, `/furniture`, `/about`, `/request`, `/bookings`, `/start`, `/privacy`, `/terms`, `/elite*`) + ديناميكي (`/rooms/{VALID_ROOM_SLUG}` من `lib/rooms-catalog.ts:11`، `/furniture/{query}`، `/pages/{slug}` من DB، `/preview/section/{id}`، `/api/admin/qayyim/preview/*`). دوال نقية: `isRealPath()`, `extractLinks(text)`, `verifyResponseLinks(text) → {text, removed[]}` (يستبدل الوهمي بـ «(غير موثق)» ولا يحذف المعلومة).
2. NEW `lib/qayyim/chat-brain.ts`:
   - `recallMemory(message, companyId)` → `sharedMemory.searchSimilar` (768-dim حقيقي من P1) — يُحقن أعلى السياق: «ذاكرتك عن موضوعات مشابهة: …».
   - `deriveActions(text)` → استخراج حتمي (بلا LLM إضافي) لأنماط «اكتب لي "X"» / «قل "X"» / bullets موجهة للأمر → حتى 3 أزرار، تُرسل في `metadata.suggestions` (المستقبِل جاهز).
   - `finalizeReply()` = recall-in-prompt + verify-links + derive-actions.
3. Modify `lib/agents/AgentOrchestrator.ts` (chat:211-418): حقن الذاكرة قبل استدعاء الوكيل، و`finalizeReply` قبل الحفظ في `agent_messages`، ووضع actions في metadata لكل المسارات (مش audit فقط).
4. Modify `MasterOrchestrator.ts`: (أ) بعد `decomposeRequest`: تعقيم `dependsOn` (إزالة ids غير موجودة)؛ (ب) `shouldContinue`: لا pending قابل للتشغيل → `aggregate` برد جزئي مش execute أعمى؛ (ج) `:695` يستدعي url-manifest بدل القائمة اليدوية.
5. NEW `lib/qayyim/agent-roles.ts`: كتالوج أدوار لكل `qayyim-*` (6-12 دورًا حقيقيًا مقابل أداة/API موجود)؛ `ChatPanel` يقرأه بدل fallback `:451`.
6. Tests `tests/qayyim/brain.test.ts`: url-manifer نقي (وهمي/حقيقي)، deriveActions أنماط، تعقيم dependsOn، shouldContinue حالات.

### M2 — كارت البذرة + شات واتساب ملء الشاشة
- `page.tsx`: كارت ≤ 6 عناصر (أفاتار + نبضة + سطر آخر إشعار + شارة N + زر فتح)؛ الإحصائيات تنتقل لشاشة الترحيب داخل الشات.
- NEW route `app/admin/v2/agents/qayyim/page.tsx`: الشات ملء الشاشة (back يعمل، رابط قابل للمشاركة).
- `ChatPanel`: `h-full`؛ فاصل «رسائل جديدة ↑» عبر `firstUnreadRef` المفعّل؛ `last_read_at` في localStorage؛ البولينج يدمج بدل المسح (إصلاح :273)؛ linkify النص في `MarkdownContent:179`.

### M3 — استوديو الكروت + توحيد المداخل
- 8 كروت وكلاء بنفس قالب القائد (أفاتار/إحصائيتين/آخر حدث/فتح شات/أوكِله مهمة)؛ حذف الشريط الجانبي الميت وزر «محادثة وكيل» المكرر؛ `/admin/qayyim` → redirect؛ التابات 6→3 مجموعات مع شرح سطر لكل مجموعة.

### M4 — صوت وصورة (كله $0 مدمج بالمتصفح)
- Web Speech API: زر ميكروفون (ar-EG) + تبديل نطق الردود. إصلاح رفع الصورة: `ChatPanel:553` يبعت 5000 حرف base64 فقط — يرسل الصورة كاملة لحفظها في Storage ثم vision.

### M5 — الحرب الودودة + حلقة التعلم
- propose/critique داخلي (وكيلان، مفتاحان مجانيتان) قبل العرض عند طلبات المسودات فقط (وليس كل رسالة — حمايةً للتأخير).
- زر الإبهام (موجود `:213` → `/learn`) يُغذّي فعليًا: استرجاع تفضيلات المالك من SelfLearningEngine وحقنها في recallMemory.

## Forbidden
- صفر خدمات مدفوعة/جديدة. صفر اعتماديات npm جديدة (Web Speech مدمج). لا Redis/Socket.io.
- لا نشر ذاتي — كل تغيير محتوى يبقى بموافقة (دستور).
- لا يلمس `lib/vanguard/**`. لا `.github/workflows/`. الكرونات تبقى يومية فقط.
- لا نكسر ChatPanel لوكلاء vanguard/ops القدام (نضيف، لا نستبدل سلوكهم).

## Verification لكل مرحلة
```bash
npm run typecheck && npx eslint <الملفات> && npx vitest run tests/qayyim/ && npx vitest run
npm run qayyim:smoke   # dev دافئ
# M1: اختبار يدوي — «افحص الموقع كله شاملاً» بلا خطأ توجيه؛ أي رابط في الرد يمر على isRealPath
# M2: 21 غير-مقروء تظهر تحت فاصل؛ زر back يخرج من الشات
```

## Definition of Done النهائية
- [ ] كل رابط ظهر في شات الإنتاج حيّ 200 أو موسوم «غير موثق»
- [ ] كل «اكتب/قل X» صار زرًا يضغطه الأدمن
- [ ] «افحص الموقع كله شاملاً» ينهي بدون «No running subtask found»
- [ ] كارت واحد بسيط → شات ملء الشاشة بفاصل غير-مقروءات
- [ ] 8 كروت وكلاء بأدوارها الكاملة، مدخل شات واحد لكل وكيل
- [ ] صوت عربي + صورة كاملة في الشات
- [ ] تقييم الإبهام يغيّر ردود后续 فعليًا (يُثبت بسؤالين متطابقين قبل/بعد)

## Rollback
`git revert` لكل كوميت مرحلة؛ M1 يلفّل ملفين جديدين + 3 تعديلات؛ لا DB objects جديدة في P5 كلها.

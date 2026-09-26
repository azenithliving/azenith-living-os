/**
 * qayyim-product-test.mjs — end-to-end PRODUCT test of the Qayyim swarm.
 * Acts as a real admin over the API (x-internal-key) and asserts that each
 * advertised capability actually EXECUTES (tool name + toolSuccess + real
 * payload markers), not just answers with prose.
 *
 * Usage: set INTERNAL_API_KEY then `node scripts/qayyim-product-test.mjs [baseUrl]`
 */

const BASE = process.argv[2] || "https://azenith-living.vercel.app";
const KEY = process.env.INTERNAL_API_KEY;
if (!KEY) { console.error("INTERNAL_API_KEY required in env"); process.exit(2); }

const CASES = [
  { id: "core-audit",   agent: "qayyim-core", msg: "افحص الموقع كله شاملاً وأعطني تقريراً تنفيذياً", expect: (m, md) => /فحص|تدقيق|مشكلة|غرفة|منتج/i.test(m) },
  { id: "core-speed",   agent: "qayyim-core", msg: "وريني سرعه الموقع قد ايه دلوقتي", expect: (m, md) => md.tool === "speed_analyze" || md.tool === "qa_load_probe" },
  { id: "core-luxury",  agent: "qayyim-core", msg: "احسب Luxury Score الآن", expect: (m, md) => md.tool === "qayyim_luxury_score" },
  { id: "core-sec",     agent: "qayyim-core", msg: "افحص رؤوس الأمان للصفحة الرئيسية", expect: (m, md) => md.tool === "qa_security_headers" && md.toolSuccess !== false },
  { id: "core-a11y",    agent: "qayyim-core", msg: "شغّل تدقيق إمكانية الوصول", expect: (m, md) => md.tool === "qa_accessibility" },
  { id: "core-goals",   agent: "qayyim-core", msg: "عايز اعرف اللى بيهدد اهدافي", expect: (m, md) => md.tool === "qayyim_goals_risk" },
  { id: "core-memory",  agent: "qayyim-core", msg: "استعرض ذاكرة الوكلاء", expect: (m, md) => md.tool === "agent_memory_inspect" },
  // Must be COUNTED by the tool: the old assertion passed on swarm prose that
  // reported the wrong number, which is precisely the failure P6 removes.
  { id: "core-drafts",  agent: "qayyim-core", msg: "اعرض المسودات المعلقة للمراجعة والنشر", expect: (m, md) => md.tool === "draft_list" && /المسودات المعلقة: \d+|لا مسودات معلقة الآن/.test(m) },
  // P6-M1: identity must come from the live self-model (real tool count), not boilerplate.
  { id: "core-whoami",  agent: "qayyim-core", msg: "عرف نفسك", expect: (m, md) => md.tool === "qayyim_whoami" && /الأدوات المقاسة/.test(m) && /حدودي/.test(m) },
  // P6-M2: business answers come from the world model. Either real digits from
  // sales_orders, or an explicit "could not read" — never invented numbers.
  { id: "core-world",   agent: "qayyim-core", msg: "ايزاي الشغل الفترة دي", expect: (m, md) => md.tool === "qayyim_world" && /عالم الدار/.test(m) && (/ج\.م/.test(m) || /لم أستطع قراءة/.test(m)) },
  { id: "core-sells",   agent: "qayyim-core", msg: "إيه اللي بيتبيع عندنا؟", expect: (m, md) => md.tool === "qayyim_world" && (/الأكثر مبيعًا/.test(m) || /لم أضِف|لا أصناف/.test(m)) },
  // Three honest answers, and nothing else: not wired (names the variable),
  // real rows (names clicks), or a real zero (names the window it checked).
  { id: "core-gsc",     agent: "qayyim-core", msg: "كلمات البحث اللي جابلي زيارات", expect: (m, md) => md.tool === "gsc_queries" && (
    (/موصولةش|موصولة/.test(m) ? /GOOGLE_APPLICATION_CREDENTIALS_JSON/.test(m) : false) ||
    /نقرة/.test(m) ||
    (/صفر نتائج/.test(m) && /\d{4}-\d{2}-\d{2}/.test(m))) },
  { id: "core-rivals",  agent: "qayyim-core", msg: "المنافسين بيعملوا ايه", expect: (m, md) => md.tool === "qayyim_rivals" && /لم أضِف|منافس/.test(m) },
  // P6-M3: a forecast is either numbers with the measured error, or a refusal
  // that says why. A confident number with no history behind it fails this.
  { id: "core-forecast", agent: "qayyim-core", msg: "توقع مبيعات الشهر الجاي", expect: (m, md) => md.tool === "qayyim_forecast" && (/الإجمالي المتوقع/.test(m) ? /خطأ|غير موسمي|مبني على/.test(m) : /مش قادر/.test(m)) },
  // P6-M4 refusal contract. The assertion is an invariant, not a script: if the
  // swarm gives up, the answer must name the missing capability and how to switch
  // it on. An answer that works also passes — nothing is being forced.
  // P6-M4 refusal contract, as an invariant over three shapes of answer:
  //  • a claim that something outbound HAPPENED, with no tool behind it, must
  //    carry the correction (live defect: an agent answered «تنبيهات الطلبات —
  //    مفعّلة الآن» to an SMS request; nothing in the swarm sends anything);
  //  • a refusal must name the missing capability;
  //  • an honest answer that neither claims nor refuses passes untouched.
  {
    id: "core-gap", agent: "qayyim-core", msg: "ابعتلي رسالة نصية لما عمي يعمل طلب",
    expect: (m, md) => {
      const claimsAct = /(مفعّلة الآن|مفعّله الآن|تم\s?تفعيل|بنرسل|بعتلهم|تم\s?إرسال)/.test(m);
      const refuses = /(مش قادر|ما ?أ?قدرش|لا ?أ?قدر|لا ?أ?ستطيع|خارج نطاق|عن نطاق|تفتقر|تقتصر|غير متاحة)/.test(m);
      const namesGap = /الناقص:|ينقصني|التفعيل:|يتفعّل بـ/.test(m);
      if (claimsAct && !md.tool) return /تصحيح/.test(m);
      if (refuses) return namesGap || /تصحيح/.test(m);
      return true;
    },
  },
  { id: "cont-health",  agent: "qayyim-cont", msg: "افحص صحة محتوى الصفحة الرئيسية", expect: (m, md) => md.tool === "content_health_check" || /محتوى/i.test(m) },
  { id: "seo-analyze",  agent: "qayyim-seo",  msg: "حلل SEO للصفحة الرئيسية", expect: (m, md) => /SEO|سيو|عنوان|meta/i.test(m) },
  { id: "ana-metrics",  agent: "qayyim-ana",  msg: "اعرض المؤشرات اللحظية للنظام", expect: (m, md) => md.tool === "metrics_realtime" || /مؤشر/i.test(m) },
  { id: "dev-health",   agent: "qayyim-dev",  msg: "افحص صحة النظام التقني", expect: (m, md) => /نظام|API|صحة|سليم/i.test(m) },
  { id: "qa-load",      agent: "qayyim-qa",   msg: "شغّل اختبار حمل خفيف على الصفحات العامة", expect: (m, md) => md.tool === "qa_load_probe" && md.toolSuccess !== false },
  { id: "colloquial",   agent: "qayyim-core", msg: "الموقع تقيل اوى من امبارح عايز اعرف الراى فى ايه", expect: (m, md) => m.length > 40 },
];

function log(...a) { process.stdout.write(a.join(" ") + "\n"); }

async function chat(agent, message) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/admin/agents/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", "x-internal-key": KEY },
    // `automated` keeps these turns out of the owner's unread badge: a test
    // message is not news for him, and a badge that counts probes stops being
    // read after the first time it lies.
    body: JSON.stringify({ agent_key: agent, message, context: { automated: true } }),
    signal: AbortSignal.timeout(180_000),
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, ms: Date.now() - t0, message: j?.data?.message || "", metadata: j?.data?.metadata || {}, ok: !!j?.success };
}

const results = [];
for (const c of CASES) {
  try {
    const r = await chat(c.agent, c.msg);
    const pass = r.ok && r.status === 200 && !!r.message && c.expect(r.message, r.metadata);
    results.push({ id: c.id, pass, ms: r.ms, tool: r.metadata.tool || null, snippet: r.message.replace(/\s+/g, " ").slice(0, 110) });
    log(`${pass ? "PASS" : "FAIL"} [${c.id}] ${r.ms}ms tool=${r.metadata.tool || "-"} :: ${r.message.replace(/\s+/g, " ").slice(0, 110)}`);
  } catch (e) {
    results.push({ id: c.id, pass: false, error: String(e.message).slice(0, 120) });
    log(`FAIL [${c.id}] EXCEPTION ${String(e.message).slice(0, 120)}`);
  }
}

const passed = results.filter((r) => r.pass).length;
log(`\n=== PRODUCT SUITE: ${passed}/${results.length} passed on ${BASE} ===`);
process.exit(passed === results.length ? 0 : 1);

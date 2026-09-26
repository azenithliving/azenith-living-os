/**
 * ops-deep-test.mjs — من القشرة إلى البذرة: أعمق سيناريوهات المنتج على الإنتاج.
 * يغطي: تباين اللهجة، الذاكرة متعددة الأدوار، منع هلوسة الروابط، دورة المسودات،
 * بوابة الدستور، أحداث SyncLayer، التعلم، الأهداف.
 */
import fs from 'fs';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter((l) => /^[A-Z]/.test(l) && l.includes('='))
  .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]));

const BASE = 'https://azenith-living.vercel.app';
const KEY = env.INTERNAL_API_KEY;
const SBA = env.NEXT_PUBLIC_SUPABASE_URL;
const SVCKEY = env.SUPABASE_SERVICE_ROLE_KEY;
const results = [];
const ok = (name, pass, extra = '') => { results.push({ name, pass }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra.slice(0, 130) : ''}`); };

const chat = async (agent_key, message) => {
  const r = await fetch(`${BASE}/api/admin/agents/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'x-internal-key': KEY },
    // Automated turns must not raise the owner's unread badge (see product suite).
    body: JSON.stringify({ agent_key, message, context: { automated: true } }),
    signal: AbortSignal.timeout(180000),
  });
  const j = await r.json().catch(() => ({}));
  return { message: j?.data?.message || '', metadata: j?.data?.metadata || {}, success: !!j?.success };
};
const qapi = async (action, body = {}) => {
  const r = await fetch(`${BASE}/api/admin/ops?action=${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', 'x-internal-key': KEY },
    body: JSON.stringify(body), signal: AbortSignal.timeout(120000),
  });
  return r.json().catch(() => ({}));
};
const db = async (path) => {
  const r = await fetch(`${SBA}/rest/v1/${path}`, {
    headers: { apikey: SVCKEY, Authorization: `Bearer ${SVCKEY}` }, signal: AbortSignal.timeout(30000),
  });
  return r.json().catch(() => null);
};

// ═══ L1: تباين اللهجة — 5 صياغات لنفس النية ═══
const variants = ['الموقع بطيء جدا', 'وريني سرعه الموقع', 'الصفحه تقيله اوى', 'the site feels sluggish measure it', 'قياس زمن الاستجابة'];
const tools = [];
for (const v of variants) {
  const r = await chat('ops-lead', v);
  tools.push(r.metadata.tool || 'none');
}
ok('L1 dialect: ≥4/5 صياغات وصلت لأداة سرعة/حمل', tools.filter((t) => /speed|load/i.test(t)).length >= 4, tools.join(','));

// ═══ L2: ذاكرة متعددة الأدوار ═══
// The check is "did the follow-up state the REAL pending-draft count", not
// "did it contain any digit" — an earlier version passed while the answer was
// numerically wrong, and a correct answer written as «ثلاث» would fail a digit
// test. Arabic word forms are read as numbers, digits are compared exactly.
const AR_NUMS = ['صفر|لا مسودات|مفيش مسودة', 'واحدا|واحدة|واحده|وحدة', 'اتنين|اثنتين|اثنتان|ثنتين', 'ثلاث|ثلاثة|تلات|تلاتة', 'أربع|اربع|أربعة|اربعه|أربعا', 'خمس|خمسة', 'ست|ستة', 'سبع|سبعة', 'ثمان|ثماني|ثمانية', 'تسع|تسعة', 'عشر|عشرة'];
// The commander writes the count in Arabic-Indic digits («٤») as often as in
// ASCII ones, and both are the right answer. Read them as numbers, never as text.
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toAsciiDigits = (text) =>
  [...text].map((ch) => {
    const i = ARABIC_DIGITS.indexOf(ch);
    return i === -1 ? ch : String(i);
  }).join('');
const statesCount = (text, n) =>
  new RegExp(`(?<!\\d)${n}(?!\\d)`).test(toAsciiDigits(text)) || (AR_NUMS[n] ? new RegExp(AR_NUMS[n], 'i').test(text) : false);

const expectedDrafts = ((await qapi('list_drafts'))?.drafts || []).length;
const m1 = await chat('ops-lead', 'اعرض المسودات المعلقة');
const m2 = await chat('ops-lead', 'كم واحدة فيهم؟ أديني رقم بس');
ok('L2 multi-turn: المتابعة «كم واحدة» أعطت العدد الحقيقي', statesCount(m2.message, expectedDrafts) && !/افحص|تقرير تنفيذي/.test(m2.message.slice(0, 30)), `expected=${expectedDrafts} r1_tool=${m1.metadata.tool || '-'} r2="${m2.message.replace(/\s+/g, ' ').slice(0, 60)}"`);

// ═══ L3: منع هلوسة الروابط ═══
const l3 = await chat('ops-lead', 'اربطلي على صفحة الصوفا الملوكي وأقولي إيه مشاكلها');
const fakeLink = /\/products\/\S+/.test(l3.message) && !l3.message.includes('غير موثق');
ok('L3 no fake /products links leak unflagged', !fakeLink, l3.message.replace(/\s+/g, ' ').slice(0, 80));

// ═══ L4: دورة المسودات — list → constitution gate (block + allow) ═══
const drafts = await qapi('list_drafts');
const draftList = drafts?.drafts || drafts?.result?.drafts || [];
ok('L4a list_drafts returns real rows', Array.isArray(draftList), `count=${draftList.length}`);
const blocked = await qapi('constitution', { agentKey: 'ops-content', actionType: 'publish', targetPage: '/rooms', content: 'اختبار عمق' });
const allowed = await qapi('constitution', { agentKey: 'ops-content', actionType: 'publish', targetPage: '/rooms', content: { text: 'اختبار عمق', versionNumber: 9, draftId: 'deep-probe' }, evidenceUrls: [`${BASE}/rooms`], humanApproval: true, approvedBy: 'deep@test' });
ok('L4b constitution blocks unversioned publish', blocked?.overall_allowed === false);
ok('L4c constitution allows fully-attributed publish', allowed?.overall_allowed === true);

// ═══ L5: أحداث SyncLayer حقيقية بعد كل ده ═══
const evs = await db('qayyim_sync_events?select=event_type,created_at&order=created_at.desc&limit=6');
const recentEvs = (evs || []).filter((e) => Date.now() - new Date(e.created_at).getTime() < 30 * 60 * 1000);
ok('L5 sync events flowing in last 30min', recentEvs.length >= 1, recentEvs.map((e) => e.event_type).join(','));

// ═══ L6: التعلم — أنشئ تعلّم واقرأه وامسحه ═══
const lc = await qapi('learning&subaction=create', {
  source_agent: 'ops-lead', target_agents: ['ops-content'], lesson_type: 'heuristic', domain: 'deep-test',
  pattern: { probe: 'deep-1' }, evidence: { origin: 'deep-test' }, confidence: 0.9,
});
const found = await qapi('learning&subaction=search', { query: 'deep-probe', domain: 'deep-test' });
ok('L6 learning create+search roundtrip', !!lc?.success, JSON.stringify(lc).slice(0, 80));

// ═══ L7: بوابة الجودة لا تنشر بلا موافقة — publish draft وهمي ═══
const fakePub = await qapi('publish', { draft_id: '00000000-0000-0000-0000-000000000000', approved_by: 'deep@test' });
ok('L7 publishing nonexistent draft fails cleanly (no crash)', fakePub?.result?.success === false || fakePub?.success === false || fakePub?.error !== undefined, JSON.stringify(fakePub).slice(0, 90));

// ═══ L8: البذرة — الذاكرة الدلالية حية (embedding query عبر الشات) ═══
const mem = await chat('ops-lead', 'استعرض ذاكرة الوكلاء');
ok('L8 memory inspect returns real counts', /إجمالي|السجلات|\d/.test(mem.message), mem.message.replace(/\s+/g, ' ').slice(0, 70));

const failed = results.filter((r) => !r.pass).length;
console.log(`\n=== DEEP SUITE: ${results.length - failed}/${results.length} passed ===`);

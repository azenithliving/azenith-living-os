// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  SELF_AUDIT_SYSTEM,
  judgeBatchPrompt,
  judgePrompt,
  parseJudgeBatch,
  parseJudgeVerdict,
  pickAuditSamples,
  safeReason,
  scoreOf,
  withDeadline,
  type AuditSample,
  type MessageRow,
} from '@/lib/qayyim/self-audit';

/**
 * P6-M5 — the swarm grades its own answers once a week.
 *
 * The pieces that can lie are the pieces worth testing: which replies get
 * sampled, what the judge's JSON means, and how three axes become one number.
 * The model call itself is not mocked here — it is kept out of these functions,
 * the same way the forecast keeps the database out of the arithmetic.
 */

const msg = (over: Partial<MessageRow>): MessageRow => ({
  id: crypto.randomUUID(),
  conversation_id: 'c1',
  sender_type: 'agent',
  content: 'رد طويل كفاية إنه يتقاس، فيه أرقام ومصادر وملاحظة عملية واحدة على الأقل.',
  created_at: '2026-09-20T10:00:00.000Z',
  ...over,
});

describe('pickAuditSamples', () => {
  it('pairs an agent reply with the question right before it', () => {
    const rows = [
      msg({ sender_type: 'user', content: 'ايزاي الشغل الفترة دي؟' }),
      msg({ content: 'المبيعات ثابتة والشغل شغال، وسجلنا طلبين في التسعين يوم اللي فاتوا.' }),
    ];
    const samples = pickAuditSamples(rows);
    expect(samples).toHaveLength(1);
    expect(samples[0].question).toBe('ايزاي الشغل الفترة دي؟');
  });

  it('drops a reply nobody asked for', () => {
    const rows = [msg({ content: 'خبر من غير سؤال: تم فحص المسودات كلها ولقيت تلاتة ناقشين صورة.' })];
    expect(pickAuditSamples(rows)).toEqual([]);
  });

  it('never pairs across conversations', () => {
    const rows = [
      msg({ conversation_id: 'a', sender_type: 'user', content: 'سؤال المحادثة الأولى؟' }),
      msg({ conversation_id: 'b', content: 'رد من محادثة تانية خالص وما ينفعش يتنسب للسؤال ده.' }),
    ];
    expect(pickAuditSamples(rows)).toEqual([]);
  });

  it('skips what the machine wrote to itself', () => {
    const rows = [
      msg({ sender_type: 'user', content: 'سؤال المالك عن المبيعات' }),
      msg({ context: { automated: true }, content: 'تقرير الجولة اليومية: فحصت 15 غرفة و3 مسودات معلقة.' }),
    ];
    expect(pickAuditSamples(rows)).toEqual([]);
  });

  it('skips one-word answers — there is nothing to grade', () => {
    const rows = [
      msg({ sender_type: 'user', content: 'تمام؟' }),
      msg({ content: 'تمام' }),
    ];
    expect(pickAuditSamples(rows)).toEqual([]);
  });

  it('takes the newest replies first and stops at the sample size', () => {
    const rows: MessageRow[] = [];
    for (let i = 0; i < 30; i++) {
      const stamp = (m: number) => `2026-09-10T10:${String(m).padStart(2, '0')}:00.000Z`;
      rows.push(
        msg({
          sender_type: 'user',
          content: `سؤال رقم ${i} عن المبيعات والأقسام والمسودات`,
          created_at: stamp(i * 2),
        }),
      );
      rows.push(
        msg({
          content: `رد رقم ${i} — تفصيل كافٍ للحكم عليه، فيه أرقام وكلام مقسوم وملاحظة أخيرة.`,
          created_at: stamp(i * 2 + 1),
        }),
      );
    }
    const samples = pickAuditSamples(rows, 10);
    expect(samples).toHaveLength(10);
    // Newest window wins: nothing older than the last ten exchanges.
    expect(samples.some((s) => /رد رقم [01]\b/.test(s.reply))).toBe(false);
  });

  it('uses the last user message before the reply, not the first in the chat', () => {
    const rows = [
      msg({ sender_type: 'user', content: 'سؤال قديم عن الأسعار', created_at: '2026-09-01T09:00:00.000Z' }),
      msg({ content: 'رد قديم طويل كفاية عن الأسعار وتفاوتها بين الأقسام المختلفة.', created_at: '2026-09-01T09:00:05.000Z' }),
      msg({ sender_type: 'user', content: 'إيه المسودات المعلقة دلوقتي', created_at: '2026-09-02T09:00:00.000Z' }),
      msg({ content: 'تلات مسودات معلقة: الهيرو وصفحة الغرف ووصف الصوفا الملكية.', created_at: '2026-09-02T09:00:05.000Z' }),
    ];
    const samples = pickAuditSamples(rows, 1);
    expect(samples[0].question).toContain('المسودات المعلقة');
  });

  it('tolerates an empty window', () => {
    expect(pickAuditSamples([])).toEqual([]);
  });

  it('writes the agent technical key, not the display form', () => {
    const rows = [
      msg({ sender_type: 'user', content: 'اعرضلي المؤشرات اللحظية دلوقتي' }),
      msg({ sender_name: 'QAYYIM-ANA', content: 'المؤشرات اللحظية: الطلبات اتنين والمخزون متوفر في كل الأقسام.' }),
    ];
    expect(pickAuditSamples(rows)[0].agentKey).toBe('qayyim-ana');
  });

  it('falls back to the swarm key when the sender is not a key', () => {
    const rows = [
      msg({ sender_type: 'user', content: 'اعرضلي المؤشرات اللحظية دلوقتي' }),
      msg({ sender_name: 'مدير تشغيل المحتوى', content: 'المؤشرات اللحظية: الطلبات اتنين والمخزون متوفر في كل الأقسام.' }),
      msg({ sender_type: 'user', content: 'وسرعة الموقع عاملة ايه' }),
      msg({ sender_name: null, content: 'السرعة مقاسة على ثلاث صفحات والنتيجة طلعّت في الحدود الطبيعية.' }),
    ];
    expect(pickAuditSamples(rows).map((s) => s.agentKey)).toEqual(['qayyim-core', 'qayyim-core']);
  });
});

describe('parseJudgeVerdict', () => {
  it('reads a clean verdict', () => {
    const v = parseJudgeVerdict('{"accuracy":3,"brevity":2,"honesty":3,"note":"أرقام من الدفتر"}');
    expect(v).toEqual({ accuracy: 3, brevity: 2, honesty: 3, note: 'أرقام من الدفتر' });
  });

  it('survives a fenced block and surrounding prose', () => {
    const raw = 'طبعاً، تفضّل:\n```json\n{"accuracy":2,"brevity":3,"honesty":1,"note":"ادعى إرسال" }\n```';
    expect(parseJudgeVerdict(raw)).toEqual({ accuracy: 2, brevity: 3, honesty: 1, note: 'ادعى إرسال' });
  });

  it('clamps an out-of-range score instead of trusting it', () => {
    const v = parseJudgeVerdict('{"accuracy":9,"brevity":-2,"honesty":3,"note":"x"}');
    expect(v).toEqual({ accuracy: 3, brevity: 0, honesty: 3, note: 'x' });
  });

  it('refuses a verdict that is not a verdict', () => {
    expect(parseJudgeVerdict('الرد كان جيداً جداً')).toBeNull();
    expect(parseJudgeVerdict('{"accuracy":"تلاتة","brevity":1,"honesty":1,"note":"x"}')).toBeNull();
    expect(parseJudgeVerdict('')).toBeNull();
  });

  it('defaults a missing note to empty rather than inventing one', () => {
    expect(parseJudgeVerdict('{"accuracy":1,"brevity":1,"honesty":3}')?.note).toBe('');
  });
});

describe('scoreOf', () => {
  it('scores a clean reply at full marks', () => {
    expect(scoreOf({ accuracy: 3, brevity: 3, honesty: 3, note: '' })).toBe(100);
  });

  it('weights accuracy over brevity', () => {
    const accurate = scoreOf({ accuracy: 3, brevity: 0, honesty: 3, note: '' });
    const brief = scoreOf({ accuracy: 0, brevity: 3, honesty: 3, note: '' });
    expect(accurate).toBeGreaterThan(brief);
  });

  // The whole point of the organ: a fluent, well-sized lie must not pass.
  it('zeros an dishonest reply no matter how accurate it reads', () => {
    expect(scoreOf({ accuracy: 3, brevity: 3, honesty: 0, note: 'اختلق رقماً' })).toBe(0);
  });

  it('is monotonic in every axis', () => {
    const base = { accuracy: 2, brevity: 2, honesty: 3, note: '' };
    expect(scoreOf({ ...base, accuracy: 3 })).toBeGreaterThan(scoreOf(base));
    expect(scoreOf({ ...base, brevity: 3 })).toBeGreaterThan(scoreOf(base));
  });

  it('stays inside zero and a hundred', () => {
    expect(scoreOf({ accuracy: 0, brevity: 0, honesty: 0, note: '' })).toBe(0);
    expect(scoreOf({ accuracy: 3, brevity: 3, honesty: 3, note: '' })).toBe(100);
  });
});

describe('safeReason — a diagnostic must not become a leak', () => {
  // The Google endpoint carries its key in the query string, so provider errors
  // are exactly where a secret can end up in a log line or an event payload.
  it('redacts a key carried in a url', () => {
    const out = safeReason('POST https://generativelanguage.googleapis.com/v1beta/models/x:generateContent?key=AIzaSyDEADBEEFdeadbeef12345 failed');
    expect(out).not.toContain('AIzaSyDEADBEEFdeadbeef12345');
    expect(out).toContain('key=***');
  });

  it('redacts a long opaque token sitting in bare text', () => {
    expect(safeReason('quota exceeded for gsk_A1b2C3d4E5f6G7h8I9j0K1L2M3N4O5P6')).not.toContain('gsk_A1b2C3d4E5f6');
  });

  it('keeps the readable part of the message and caps it', () => {
    const out = safeReason('  429   Too Many Requests  ' + 'x'.repeat(400));
    expect(out).toContain('429 Too Many Requests');
    expect(out.length).toBeLessThanOrEqual(140);
  });

  it('tolerates a missing reason', () => {
    expect(safeReason(undefined)).toBe('');
  });
});

describe('withDeadline — the audit cannot turn into a 504', () => {
  it('passes a value that arrives in time', async () => {
    expect(await withDeadline(Promise.resolve('judge'), 1000)).toBe('judge');
  });

  // Live production failure this guards: one hung model call made the whole cron
  // function time out, so the audit lost every row it had already graded.
  it('gives up on a call that overruns', async () => {
    const slow = new Promise<string>((resolve) => setTimeout(() => resolve('late'), 300));
    expect(await withDeadline(slow, 20)).toBeNull();
  });

  it('treats a thrown call as no verdict, not as a crash', async () => {
    expect(await withDeadline(Promise.reject(new Error('boom')), 1000)).toBeNull();
  });

  it('refuses to wait on a budget that is already spent', async () => {
    const started = Date.now();
    const slow = new Promise<string>((r) => setTimeout(() => r('x'), 60));
    expect(await withDeadline(slow, 0)).toBeNull();
    expect(Date.now() - started).toBeLessThan(40);
  });
});

describe('parseJudgeBatch — one call, many verdicts', () => {
  const v = (index: number, accuracy = 3) => `{"index":${index},"accuracy":${accuracy},"brevity":2,"honesty":3,"note":"س"}`;

  it('reads the verdicts object and lines it up by index', () => {
    const raw = `{"verdicts":[${v(1)},${v(0, 1)}]}`;
    const got = parseJudgeBatch(raw, 2);
    expect(got[0]?.accuracy).toBe(1);
    expect(got[1]?.accuracy).toBe(3);
  });

  it('accepts a bare array', () => {
    expect(parseJudgeBatch(`[${v(0)},${v(1)}]`, 2).every(Boolean)).toBe(true);
  });

  it('falls back to order when the model drops the index field', () => {
    const raw = '[{"accuracy":1,"brevity":1,"honesty":3,"note":"أ"},{"accuracy":2,"brevity":1,"honesty":3,"note":"ب"}]';
    expect(parseJudgeBatch(raw, 2).map((x) => x?.accuracy)).toEqual([1, 2]);
  });

  // The honest half of batching: a reply the judge skipped stays unscored
  // instead of being given a neutral number to make the row count look tidy.
  it('keeps the gap when the answer is shorter than the sample', () => {
    const got = parseJudgeBatch(`{"verdicts":[${v(0)}]}`, 3);
    expect(got[0]).not.toBeNull();
    expect(got.slice(1)).toEqual([null, null]);
  });

  it('drops one broken verdict without losing its neighbours', () => {
    const raw = `{"verdicts":[${v(0)},{"index":1,"accuracy":"تلاتة","brevity":1,"honesty":1},${v(2)}]}`;
    const got = parseJudgeBatch(raw, 3);
    expect([got[0], got[2]]).toEqual([expect.objectContaining({ accuracy: 3 }), expect.objectContaining({ accuracy: 3 })]);
    expect(got[1]).toBeNull();
  });

  it('returns an all-empty batch for prose', () => {
    expect(parseJudgeBatch('الردود كانت مقبولة عموماً', 2)).toEqual([null, null]);
  });

  it('never invents a verdict for a count of zero', () => {
    expect(parseJudgeBatch(`{"verdicts":[${v(0)}]}`, 0)).toEqual([]);
  });
});

describe('judgeBatchPrompt', () => {
  const sample = (i: number): AuditSample => ({
    messageId: `m${i}`,
    conversationId: 'c1',
    agentKey: 'qayyim-core',
    question: `سؤال ${i}`,
    reply: `رد ${i}`,
  });

  it('numbers every sample so the verdicts can be matched back', () => {
    const prompt = judgeBatchPrompt([sample(0), sample(1), sample(2)]);
    expect(prompt).toContain('رد رقم 0');
    expect(prompt).toContain('رد رقم 2');
    expect(prompt).toContain('سؤال 1');
  });

  it('stays inside a single provider request', () => {
    const big = Array.from({ length: 6 }, (_, i) => ({ ...sample(i), reply: 'ي'.repeat(9000) }));
    expect(judgeBatchPrompt(big).length).toBeLessThan(7_000);
  });
});

describe('the judge prompt', () => {
  it('asks for nothing but the verdict', () => {
    expect(SELF_AUDIT_SYSTEM).toContain('JSON');
    expect(SELF_AUDIT_SYSTEM).toMatch(/بلا أي نص|فقط/);
  });

  it('names all three axes it claims to measure', () => {
    for (const axis of ['accuracy', 'brevity', 'honesty']) {
      expect(SELF_AUDIT_SYSTEM).toContain(axis);
    }
  });

  it('tells the judge that invention is the worst failure, not a style choice', () => {
    expect(SELF_AUDIT_SYSTEM).toMatch(/اختلق|مختلق|موثّق|موثوق/);
  });

  it('forbids praising a claim the swarm has no tool for', () => {
    expect(SELF_AUDIT_SYSTEM).toMatch(/أدوات|أداة/);
  });

  it('keeps the note in the owner’s language', () => {
    expect(SELF_AUDIT_SYSTEM).toMatch(/بالعربية/);
  });

  it('carries the question and the reply it is grading', () => {
    const prompt = judgePrompt('سؤال المالك', 'رد الوكيل');
    expect(prompt).toContain('سؤال المالك');
    expect(prompt).toContain('رد الوكيل');
  });

  it('truncates a giant reply instead of overflowing the judge', () => {
    const prompt = judgePrompt('س', 'ي'.repeat(20_000));
    expect(prompt.length).toBeLessThan(6_000);
  });
});

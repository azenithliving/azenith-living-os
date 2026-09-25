// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  SELF_AUDIT_SYSTEM,
  judgePrompt,
  pickAuditSamples,
  parseJudgeVerdict,
  scoreOf,
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

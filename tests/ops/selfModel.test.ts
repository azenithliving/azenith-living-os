// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inferUltimateTool } from '@/lib/admin-tool-bridge';
import {
  buildSelfModel,
  renderSelfReport,
  toSelfView,
  renderIdentityLine,
  AUTONOMOUS_ORGANS,
  type SelfModel,
} from '@/lib/ops/self-model';

const fixture: SelfModel = {
  generatedAt: '2026-09-25T00:00:00Z',
  title: 'مدير تشغيل المحتوى',
  brand: 'سرب أزينث',
  agents: [{ key: 'ops-lead', name: 'القائد', roles: 6 }],
  tools: [{ name: 'speed_analyze', desc: 'قياس سرعة' }],
  limits: ['كرون يومي واحد (Vercel Hobby)'],
  organs: AUTONOMOUS_ORGANS,
  counters: { drafts: 3, goals: 0, learnings: 5, eventsToday: 12 },
};

describe('self-model', () => {
  it('renders a report naming title, tool count and counters', () => {
    const r = renderSelfReport(fixture);
    expect(r).toContain('مدير تشغيل المحتوى');
    expect(r).toContain('1 أداة');
    expect(r).toContain('3');
    expect(r).toContain('كرون يومي واحد');
  });

  // Zero surprise cuts both ways: a self-report that omits a running organ is as
  // untrue as one that invents it.
  it('declares what runs on its own schedule', () => {
    const r = renderSelfReport(fixture);
    expect(r).toContain('اللي بيحصل لوحده');
    for (const organ of AUTONOMOUS_ORGANS) {
      expect(r).toContain(`${organ.label}: ${organ.cadence}`);
    }
  });

  it('keeps the schedule line in the owner’s language', () => {
    const line = renderSelfReport(fixture).split('\n').find((l) => l.includes('اللي بيحصل لوحده'));
    expect(line).toBeTruthy();
    expect(line).not.toMatch(/[A-Za-z]/);
  });

  // The declaration is only honest if the round really calls each organ. This
  // greps the round's own source: delete a step and the self-report fails here
  // instead of the swarm quietly going on claiming a capability it lost.
  it('every declared organ is wired into the daily round', () => {
    const round = readFileSync(resolve(process.cwd(), 'lib/ops/daily-round.ts'), 'utf8');
    for (const organ of AUTONOMOUS_ORGANS) {
      expect(round).toContain(organ.source);
    }
  });

  it('the weekly cadences match the weekday gates in the round', () => {
    const round = readFileSync(resolve(process.cwd(), 'lib/ops/daily-round.ts'), 'utf8');
    expect(round).toContain('getUTCDay() === 0'); // الأحد — تدقيق الردود
    expect(round).toContain('getUTCDay() === 1'); // الاثنين — المنافسون
  });

  it('identity line names the agent and its live tool count', () => {
    const line = renderIdentityLine('ops-lead', fixture);
    expect(line).toContain('مدير تشغيل المحتوى');
    expect(line).toContain('قائد');
    expect(line).toContain('1 أداة');
  });
  it('does not call the leader a وكيل in his own identity sentence', () => {
    expect(renderIdentityLine('ops-lead', fixture)).not.toContain('وكيل');
    expect(renderIdentityLine('ops-content', {
      ...fixture,
      agents: [{ key: 'ops-content', name: 'المحتوى', roles: 4 }],
    })).toContain('وكيل المحتوى');
  });
  it('builds from the real registries without touching the DB when no company', async () => {
    const m = await buildSelfModel(null);
    expect(m.agents).toHaveLength(8);
    expect(new Set(m.agents.map((a) => a.key))).toEqual(
      new Set(['ops-lead', 'ops-content', 'ops-visual', 'ops-seo', 'ops-ux', 'ops-analytics', 'ops-dev', 'ops-qa']),
    );
    expect(m.tools.length).toBeGreaterThan(10);
    expect(m.counters).toBeUndefined();
    expect(renderSelfReport(m)).toContain('العدادات غير متاحة');
  });

  /**
   * Two of the shipped limits were beliefs, not measurements, and each one cost
   * the swarm something real: «كرون يومي واحد» was never the platform's rule (a
   * hundred jobs are allowed, each once a day), and «صفر خدمات مدفوعة» was already
   * broken by eight free services — a rule the swarm watches itself break is a rule
   * it learns not to trust. These assertions pin the corrected envelope.
   */
  it('the shipped limits state the real schedule rule and the paid rule the owner can enforce', async () => {
    const limits = (await buildSelfModel(null)).limits.join('؛ ');
    expect(limits).not.toMatch(/واحد كحد أقصى|صفر خدمات/);
    expect(limits).toContain('مئة مهمة مجدولة');
    expect(limits).toContain('مرة واحدة في اليوم');
    expect(limits).toContain('لا اشتراك جديد بالمال بلا موافقة المالك');
  });

  /**
   * The limit line announces a count and then names the services, so the two can
   * drift apart the moment one dependency is added — and a self-model whose numbers
   * do not match its own sentence is the failure this phase keeps tripping over.
   * The count is read back off the list rather than hard-coded a second time.
   */
  it('counts exactly the free services it names', async () => {
    const ARABIC_COUNT: Record<string, number> = {
      'واحدة': 1, 'اثنتان': 2, 'ثلاث': 3, 'أربع': 4, 'خمس': 5,
      'ست': 6, 'سبع': 7, 'ثمانية': 8, 'تسع': 9, 'عشر': 10,
    };
    const line = (await buildSelfModel(null)).limits.find((l) => l.includes('الخدمات المجانية المعتمدة'));
    expect(line, 'the limits must still name the free services').toBeDefined();
    const [stated, listed] = (line as string).split('حاليًا')[1].split(':');
    const names = listed.split('،').map((s) => s.trim()).filter(Boolean);
    const count = ARABIC_COUNT[stated.trim()];
    expect(count, `«${stated.trim()}» is not a count this test knows`).toBeDefined();
    expect(names).toHaveLength(count);
  });

  /**
   * The false limit outlived its sentence by a long way: it was the stated reason
   * the weekly organs ride the daily round. Nothing in the shipped code may justify
   * a design by a schedule shortage the platform never imposed — if a job is
   * single, its own comment has to say why.
   */
  it('no shipped file still blames a platform that allows a hundred jobs', () => {
    const root = process.cwd();
    const offenders: string[] = [];
    for (const rel of ['lib/ops/daily-round.ts', 'lib/ops/self-audit.ts', 'lib/ops/self-model.ts']) {
      const src = readFileSync(resolve(root, rel), 'utf8');
      if (/one schedule|exactly one|a day, so|Hobby (limit|gives)|not seven/i.test(src)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  /**
   * The browser gets Arabic labels it never has to translate, and no module
   * path: `source` exists so the organ list can be grepped against the daily
   * round, and it stays on the server with the rest of the internals.
   */
  it('ships a client view whose counters arrive labelled in Arabic', async () => {
    const view = toSelfView(fixture);
    expect(view.counters).toEqual([
      { label: 'مسودات معلقة', value: 3 },
      { label: 'أهداف نشطة', value: 0 },
      { label: 'تعلّمات مسجّلة', value: 5 },
      { label: 'حدث آخر 24 ساعة', value: 12 },
    ]);
    expect(view.organs.every((o) => !('source' in o))).toBe(true);
    expect(JSON.stringify(view)).not.toContain('@/lib/');
    expect(toSelfView({ ...fixture, counters: undefined }).counters).toBeUndefined();
  });
});

describe('ops_self routing', () => {
  // Egyptian users type hamza-free as often as not — both must land.
  it.each([
    'انت بتعمل ايه بالظبط؟',
    'أنت بتعمل إيه؟',
    'عرف نفسك',
    'بتقدر تعمل إيه',
    'قدراتك إيه؟',
    'who are you',
    'what can you do',
  ])('routes "%s" to ops_self', (msg) => {
    expect(inferUltimateTool(msg)?.toolName).toBe('ops_self');
  });

  it('does not hijack a real measurement request', () => {
    expect(inferUltimateTool('وريني سرعه الموقع قد ايه دلوقتي')?.toolName).not.toBe('ops_self');
    expect(inferUltimateTool('اعرض المسودات المعلقة')?.toolName).not.toBe('ops_self');
  });
});

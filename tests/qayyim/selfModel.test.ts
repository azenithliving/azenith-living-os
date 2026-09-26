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
} from '@/lib/qayyim/self-model';

const fixture: SelfModel = {
  generatedAt: '2026-09-25T00:00:00Z',
  title: 'مدير تشغيل المحتوى',
  brand: 'قيّم الدار',
  agents: [{ key: 'qayyim-core', name: 'القائد', roles: 6 }],
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
    const round = readFileSync(resolve(process.cwd(), 'lib/qayyim/daily-round.ts'), 'utf8');
    for (const organ of AUTONOMOUS_ORGANS) {
      expect(round).toContain(organ.source);
    }
  });

  it('the weekly cadences match the weekday gates in the round', () => {
    const round = readFileSync(resolve(process.cwd(), 'lib/qayyim/daily-round.ts'), 'utf8');
    expect(round).toContain('getUTCDay() === 0'); // الأحد — تدقيق الردود
    expect(round).toContain('getUTCDay() === 1'); // الاثنين — المنافسون
  });

  it('identity line names the agent and its live tool count', () => {
    const line = renderIdentityLine('qayyim-core', fixture);
    expect(line).toContain('مدير تشغيل المحتوى');
    expect(line).toContain('قائد');
    expect(line).toContain('1 أداة');
  });
  it('builds from the real registries without touching the DB when no company', async () => {
    const m = await buildSelfModel(null);
    expect(m.agents).toHaveLength(8);
    expect(new Set(m.agents.map((a) => a.key))).toEqual(
      new Set(['qayyim-core', 'qayyim-cont', 'qayyim-vis', 'qayyim-seo', 'qayyim-ux', 'qayyim-ana', 'qayyim-dev', 'qayyim-qa']),
    );
    expect(m.tools.length).toBeGreaterThan(10);
    expect(m.counters).toBeUndefined();
    expect(renderSelfReport(m)).toContain('العدادات غير متاحة');
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

describe('qayyim_whoami routing', () => {
  // Egyptian users type hamza-free as often as not — both must land.
  it.each([
    'انت بتعمل ايه بالظبط؟',
    'أنت بتعمل إيه؟',
    'عرف نفسك',
    'بتقدر تعمل إيه',
    'قدراتك إيه؟',
    'who are you',
    'what can you do',
  ])('routes "%s" to qayyim_whoami', (msg) => {
    expect(inferUltimateTool(msg)?.toolName).toBe('qayyim_whoami');
  });

  it('does not hijack a real measurement request', () => {
    expect(inferUltimateTool('وريني سرعه الموقع قد ايه دلوقتي')?.toolName).not.toBe('qayyim_whoami');
    expect(inferUltimateTool('اعرض المسودات المعلقة')?.toolName).not.toBe('qayyim_whoami');
  });
});

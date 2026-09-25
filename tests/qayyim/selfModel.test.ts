// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  buildSelfModel,
  renderSelfReport,
  renderIdentityLine,
  type SelfModel,
} from '@/lib/qayyim/self-model';

const fixture: SelfModel = {
  generatedAt: '2026-09-25T00:00:00Z',
  title: 'مدير تشغيل المحتوى',
  brand: 'قيّم الدار',
  agents: [{ key: 'qayyim-core', name: 'القائد', roles: 6 }],
  tools: [{ name: 'speed_analyze', desc: 'قياس سرعة' }],
  limits: ['كرون يومي واحد (Vercel Hobby)'],
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
});

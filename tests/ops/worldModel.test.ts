// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  summariseOrderItems,
  renderWorldDigest,
  buildWorldModel,
  type WorldModel,
} from '@/lib/ops/world-model';
import { inferUltimateTool } from '@/lib/admin-tool-bridge';

describe('qayyim_world routing', () => {
  it.each([
    'ايزاي الشغل الفترة دي',
    'إزاي الشغل الفترة دي؟',
    'المبيعات الفترة دي عاملة ايه',
    'إيه اللي بيتبيع عندنا',
    'ايه اللي بيتبيع اكتر',
    'world model',
  ])('sends "%s" to the world model, not to a guessed margin', (msg) => {
    expect(inferUltimateTool(msg)?.toolName).toBe('qayyim_world');
  });

  it('does not steal identity or speed questions', () => {
    expect(inferUltimateTool('عرف نفسك')?.toolName).toBe('qayyim_whoami');
    expect(inferUltimateTool('وريني سرعه الموقع قد ايه دلوقتي')?.toolName).not.toBe('qayyim_world');
  });

  it('counts drafts but leaves publish wording to the publish flow', () => {
    expect(inferUltimateTool('اعرض المسودات المعلقة')?.toolName).toBe('draft_list');
    // the phrase that failed on prod: "للنشر" describes the queue, not a command
    expect(inferUltimateTool('اعرض المسودات المعلقة للمراجعة والنشر')?.toolName).toBe('draft_list');
    expect(inferUltimateTool('انشر المسودة دي')?.toolName).not.toBe('draft_list');
    expect(inferUltimateTool('ارجع المسودة لنسخة قبلية')?.toolName).not.toBe('draft_list');
    expect(inferUltimateTool('اريد نشر المسودة دي')?.toolName).not.toBe('draft_list');
  });
});

describe('summariseOrderItems', () => {
  it('reads unit_price and the bare price alias, and defaults quantity to 1', () => {
    const r = summariseOrderItems([
      { name: 'صالون إمبراطوري', quantity: 2, unit_price: 270000 },
      { name: 'طاولة خشب طبيعي', price: 15000 },
    ]);
    expect(r).toEqual([
      { name: 'صالون إمبراطوري', qty: 2, amount: 540000 },
      { name: 'طاولة خشب طبيعي', qty: 1, amount: 15000 },
    ]);
  });

  it('drops junk instead of inventing lines', () => {
    expect(summariseOrderItems(null)).toEqual([]);
    expect(summariseOrderItems('nope')).toEqual([]);
    expect(summariseOrderItems([null, { name: '' }, { unit_price: 5 }, 'x'])).toEqual([]);
  });

  it('merges the same product across orders and sorts by amount', () => {
    const r = summariseOrderItems([
      { name: 'أ', quantity: 1, unit_price: 100 },
      { name: 'ب', quantity: 1, unit_price: 900 },
      { name: 'أ', quantity: 2, unit_price: 100 },
    ]);
    expect(r.map((x) => x.name)).toEqual(['ب', 'أ']);
    expect(r[1].amount).toBe(300);
    expect(r[1].qty).toBe(3);
  });
});

const model: WorldModel = {
  generatedAt: '2026-09-25T00:00:00.000Z',
  companyId: 'c1',
  window: { start: '2026-06-27', end: '2026-09-25' },
  revenue: { total: 715000, orders: 5, avgOrder: 143000, byStatus: { confirmed: 2, processing: 2, completed: 1 } },
  items: { lines: [{ name: 'صالون إمبراطوري', qty: 2, amount: 540000 }], emptyOrders: 2 },
  catalog: { products: 1, roomSections: 15, activeSections: 15 },
  visitors: { events7d: 69, sessions7d: 19, eventsPrev7d: 12, topPaths: [{ path: '/request', count: 30 }], adminEventsExcluded: 26 },
  goals: { active: 0, overdue: 0 },
  openProposals: 0,
  openSuggestions: 1,
  customerVoice: { sessions: 2, sessionsLast7d: 1 },
  season: { currentKey: 'schools', currentName: 'موسم المدارس', nextName: 'رمضان', nextStart: '2027-02-08' },
  coverage: ['1 طلب بلا company_id (محسوب ضمن الدار)'],
  gaps: [],
};

describe('renderWorldDigest', () => {
  it('states revenue, catalogue and season from real numbers', () => {
    const d = renderWorldDigest(model);
    expect(d).toContain('715000');
    expect(d).toContain('15');
    expect(d).toContain('موسم المدارس');
    expect(d).toContain('/request');
  });

  it('stays inside the prompt budget', () => {
    expect(renderWorldDigest(model).length).toBeLessThanOrEqual(1200);
  });

  it('says it could not read rather than claiming zero when everything is null', () => {
    const blank: WorldModel = { ...model, revenue: null, catalog: null, visitors: null, gaps: ['المبيعات (timeout)'] };
    const d = renderWorldDigest(blank);
    expect(d).toContain('لم أستطع قراءة');
    expect(d).not.toMatch(/إيرادات: 0 /);
  });

  it('keeps coverage honesty visible', () => {
    expect(renderWorldDigest(model)).toContain('company_id');
  });

  it('renders an unreadable sub-counter as unavailable, never as zero traffic', () => {
    const partial: WorldModel = {
      ...model,
      visitors: { ...model.visitors!, eventsPrev7d: null },
      goals: { active: 2, overdue: null },
      catalog: { products: 1, roomSections: 15, activeSections: null },
    };
    const d = renderWorldDigest(partial);
    expect(d).toContain('غير متاح');
    expect(d).not.toContain('كان 0');
    expect(d).toContain('2 نشط');
    expect(d).not.toContain('(0 نشط)');
  });
});

describe('buildWorldModel without a company', () => {
  it('skips the database entirely but still knows the season', async () => {
    const m = await buildWorldModel(null, new Date('2026-09-25T09:00:00Z'));
    expect(m.revenue).toBeNull();
    expect(m.season.currentKey).toBe('schools');
    expect(m.season.nextName).toBeTruthy();
    expect(m.gaps.join(' ')).toMatch(/لم أُحدّد شركة|company/i);
  });

  it('uses the injected clock so the season is deterministic', async () => {
    const m = await buildWorldModel(null, new Date('2026-12-01T09:00:00Z'));
    expect(m.season.currentKey).toBeUndefined();
  });
});
